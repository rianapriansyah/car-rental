import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { useSearchParams } from 'react-router-dom'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { InternalCarMonthFilter } from '../../../components/InternalCarMonthFilter'
import { supabase } from '../../../lib/supabase'
import {
  TRANSACTION_CATEGORY_LABELS,
  transactionCategoryLabel,
  type TransactionRow,
  type TransactionCategory,
} from '../../../types/transaction'
import { formatIdr } from '../../../lib/formatIdr'
import { ManualTransactionDialog } from './ManualTransactionDialog'
import {
  downloadLedgerReport,
  fetchCompanyDisplayName,
  fetchLedgerRentalMap,
} from '../../../lib/ledgerPdf'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { computePartnerRentalFeeForTransactions } from '../../../lib/partnerRentalFee'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type CarOption = {
  id: string
  name: string
  plate: string
  ownership_type: string | null
  has_gps: boolean | null
  v2_partners: { name: string } | null
}

type TransactionGridRow = TransactionRow & { runningBalance: number }

function transactionSearchBlob(row: TransactionRow): string {
  const typeId = row.type === 'income' ? 'pemasukan' : 'pengeluaran'
  const catLabel = transactionCategoryLabel(row.category)
  const catId = TRANSACTION_CATEGORY_LABELS[row.category as TransactionCategory] ?? row.category
  const auto = row.auto_fee
    ? 'auto otomatis biaya otomatis'
    : 'manual'
  const amt = formatIdr(Number(row.amount))
  return `${row.type} ${typeId} ${row.category} ${catLabel} ${catId} ${row.manual_note ?? ''} ${amt} ${auto}`.toLowerCase()
}

export function TransactionsPage() {
  const [searchParams] = useSearchParams()
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState<string>('')
  const [month, setMonth] = useState(() => dayjs().startOf('month'))
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [feePct, setFeePct] = useState(0)

  const [keyword, setKeyword] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name, plate, ownership_type, has_gps, v2_partners(name)')
      .is('deleted_at', null)
      .order('name')
    if (qError) {
      setError(qError.message)
      return
    }
    const list = data ?? []
    setCars(list)
    const fromUrl = searchParams.get('car')
    setCarId((prev) => {
      if (fromUrl && list.some((c) => c.id === fromUrl)) return fromUrl
      if (prev && list.some((c) => c.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [searchParams])

  const loadTx = useCallback(async () => {
    if (!carId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const monthStr = month.format('YYYY-MM')
    const start = `${monthStr}-01T00:00:00.000Z`
    const [y, m] = monthStr.split('-').map(Number)
    const next = new Date(y, m, 1)
    const end = next.toISOString()

    const { data, error: qError } = await supabase
      .from('v2_transactions')
      .select('*')
      .eq('car_id', carId)
      .gte('recorded_at', start)
      .lt('recorded_at', end)
      .order('recorded_at', { ascending: true })

    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows(data ?? [])
  }, [carId, month])

  useEffect(() => {
    void loadCars()
    void (async () => {
      const { data: rentalKey } = await supabase
        .from('v2_app_settings')
        .select('value')
        .eq('key', 'rental_fee_pct')
        .maybeSingle()
      if (rentalKey?.value) {
        setFeePct(Number(rentalKey.value))
        return
      }
      const { data: legacy } = await supabase
        .from('v2_app_settings')
        .select('value')
        .eq('key', 'partner_fee_pct')
        .maybeSingle()
      if (legacy?.value) setFeePct(Number(legacy.value))
    })()
  }, [loadCars])

  useEffect(() => {
    void loadTx()
  }, [loadTx])

  const selectedCar = useMemo(() => cars.find((c) => c.id === carId) ?? null, [cars, carId])

  const isPartnerCar = useMemo(
    () => selectedCar?.ownership_type === 'partner',
    [selectedCar],
  )

  async function handleDownloadLedgerPdf() {
    if (!carId || !selectedCar) return
    setPdfBusy(true)
    try {
      const rentalIds = rows.map((t) => t.rental_id).filter(Boolean) as string[]
      const [rentalById, companyName] = await Promise.all([
        fetchLedgerRentalMap(supabase, rentalIds),
        fetchCompanyDisplayName(supabase),
      ])
      downloadLedgerReport({
        companyName,
        month: month.format('YYYY-MM'),
        car: {
          name: selectedCar.name,
          plate: selectedCar.plate,
          ownership_type: selectedCar.ownership_type ?? 'rental',
          partnerName: selectedCar.v2_partners?.name ?? null,
          hasGps: Boolean(selectedCar.has_gps),
        },
        transactions: rows,
        rentalById,
      })
    } finally {
      setPdfBusy(false)
    }
  }

  const { financials, gridRows, filteredGridRows, tableFiltersActive } = useMemo(() => {
    let b = 0
    const out: TransactionGridRow[] = []
    let totalIncome = 0
    let totalExpenseOps = 0 // expenses except rental_fee (GPS, maintenance, etc.)

    for (const t of rows) {
      const amt = Number(t.amount)
      const delta = t.type === 'income' ? amt : -amt
      b += delta
      out.push({ ...t, runningBalance: b })

      if (t.type === 'income') {
        totalIncome += amt
      } else if (t.category !== 'rental_fee' && t.category !== 'partner_fee') {
        totalExpenseOps += amt
      }
    }

    const feeRental = isPartnerCar ? computePartnerRentalFeeForTransactions(rows, feePct) : 0
    const nettForPartner = totalIncome - totalExpenseOps - feeRental

    const filtered = out.filter((t) => matchesSearchTokens(transactionSearchBlob(t), keyword))

    const tableFiltersActive = Boolean(keyword.trim())

    let runningFiltered: TransactionGridRow[] = []
    if (tableFiltersActive) {
      let run = 0
      runningFiltered = filtered.map((t) => {
        const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
        run += delta
        return { ...t, runningBalance: run }
      })
    }

    return {
      financials: { totalIncome, totalExpenseOps, feeRental, nettForPartner },
      gridRows: out,
      filteredGridRows: tableFiltersActive ? runningFiltered : out,
      tableFiltersActive,
    }
  }, [rows, keyword, feePct, isPartnerCar])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<TransactionGridRow>[] = useMemo(
    () => [
      {
        field: 'recorded_at',
        headerName: 'Waktu',
        width: 180,
        valueGetter: (_v, row) =>
          row.recorded_at ? new Date(row.recorded_at).toLocaleString('id-ID') : '—',
      },
      { field: 'type', headerName: 'Tipe', width: 100 },
      {
        field: 'category',
        headerName: 'Kategori',
        width: 140,
        valueGetter: (_v, row) => transactionCategoryLabel(row.category),
      },
      {
        field: 'amount',
        headerName: 'Jumlah',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => formatIdr(Number(row.amount)),
      },
      {
        field: 'runningBalance',
        headerName: 'Saldo',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => formatIdr(row.runningBalance),
      },
      {
        field: 'auto_fee',
        headerName: 'Biaya Otomatis',
        width: 100,
        renderCell: (params) =>
          params.row.auto_fee ? <Chip size="small" label="Auto" color="secondary" sx={{ my: 0.5 }} /> : null,
      },
      {
        field: 'manual_note',
        headerName: 'Catatan',
        flex: 1,
        minWidth: 160,
        valueGetter: (_v, row) => row.manual_note ?? '—',
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Transaksi
      </Typography>
      <InternalCarMonthFilter
        cars={cars}
        carId={carId}
        onCarIdChange={setCarId}
        month={month}
        onMonthChange={setMonth}
      />

      {carId ? (
        <InternalDataGridSearchPanel
          keyword={keyword}
          onKeywordChange={setKeyword}
          onSubmit={handleSearch}
          onClear={handleClear}
          searchPlaceholder="Cari tipe, kategori, jumlah, catatan, auto/manual…"
          loading={loading}
        />
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button
          variant="contained"
          disabled={!carId}
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => setDialogOpen(true)}
        >
          Tambah transaksi
        </Button>
      </Box>

      {carId ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            Rincian Keuangan — {month.format('YYYY-MM')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: isPartnerCar ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Pemasukan</Typography>
              <Typography variant="subtitle2" color="success.main" fontWeight={700}>{formatIdr(financials.totalIncome)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Pengeluaran</Typography>
              <Typography variant="subtitle2" color="error.main" fontWeight={700}>{formatIdr(financials.totalExpenseOps)}</Typography>
            </Box>
            {isPartnerCar ? (
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary">Biaya Pengelolaan ({feePct}%)</Typography>
                  <Typography variant="subtitle2" color="warning.main" fontWeight={700}>{formatIdr(financials.feeRental)}</Typography>
                </Box>
                <Box>
                  <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, mr: 2 }} />
                  <Typography variant="caption" color="text.secondary">Neto Mitra</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{formatIdr(financials.nettForPartner)}</Typography>
                </Box>
              </>
            ) : (
              <Box>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, mr: 2 }} />
                <Typography variant="caption" color="text.secondary">Saldo Bersih</Typography>
                <Typography variant="subtitle2" fontWeight={700}>{formatIdr(financials.nettForPartner)}</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              disabled={pdfBusy}
              onClick={() => void handleDownloadLedgerPdf()}
            >
              Unduh Rekap Bulan Berjalan
            </Button>
          </Box>
          {tableFiltersActive ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Rincian mencakup semua transaksi bulan ini. Kolom saldo hanya mencerminkan baris yang difilter.
            </Typography>
          ) : null}
        </Paper>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!carId ? (
        <Typography color="text.secondary">Pilih kendaraan untuk melihat buku kas.</Typography>
      ) : !loading && gridRows.length === 0 ? (
        <Typography color="text.secondary">Tidak ada transaksi bulan ini.</Typography>
      ) : (
        <Paper
          sx={{
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
            mt: error ? 2 : 0,
          }}
          variant="outlined"
        >
          <DataGrid
            rows={filteredGridRows}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 'none' }}
          />
        </Paper>
      )}
      {carId ? (
        <ManualTransactionDialog
          open={dialogOpen}
          carId={carId}
          onClose={() => setDialogOpen(false)}
          onSaved={() => void loadTx()}
        />
      ) : null}
    </Box>
  )
}
