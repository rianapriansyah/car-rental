import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import type { TransactionRow, TransactionCategory, TransactionType } from '../../../types/transaction'
import { formatIdr } from '../../../lib/formatIdr'
import { ManualTransactionDialog } from './ManualTransactionDialog'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const CATEGORY_OPTIONS: TransactionCategory[] = [
  'rental_income',
  'gps_topup',
  'maintenance',
  'partner_fee',
  'owner_withdrawal',
  'other',
]

type CarOption = { id: string; name: string; ownership_type: string | null }

type TransactionGridRow = TransactionRow & { runningBalance: number }

function matchesKeyword(row: TransactionRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.type} ${row.category} ${row.manual_note ?? ''} ${formatIdr(Number(row.amount))}`.toLowerCase()
  return blob.includes(s)
}

export function TransactionsPage() {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState<string>('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [feePct, setFeePct] = useState(0)

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'' | TransactionType>('')
  const [categoryFilter, setCategoryFilter] = useState<'' | TransactionCategory>('')
  const [autoFeeFilter, setAutoFeeFilter] = useState<'' | 'yes' | 'no'>('')

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name, ownership_type')
      .is('deleted_at', null)
      .order('name')
    if (qError) {
      setError(qError.message)
      return
    }
    setCars(data ?? [])
    setCarId((prev) => prev || (data?.[0]?.id ?? ''))
  }, [])

  const loadTx = useCallback(async () => {
    if (!carId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const start = `${month}-01T00:00:00.000Z`
    const [y, m] = month.split('-').map(Number)
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
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'partner_fee_pct')
      .maybeSingle()
      .then(({ data }) => { if (data?.value) setFeePct(Number(data.value)) })
  }, [loadCars])

  useEffect(() => {
    void loadTx()
  }, [loadTx])

  const isPartnerCar = useMemo(
    () => cars.find((c) => c.id === carId)?.ownership_type === 'partner',
    [cars, carId],
  )

  const { financials, gridRows, filteredGridRows, tableFiltersActive } = useMemo(() => {
    let b = 0
    const out: TransactionGridRow[] = []
    let totalIncome = 0
    let totalExpenseOps = 0   // all expenses except partner_fee (GPS, maintenance, etc.)
    let totalPartnerFee = 0   // auto-recorded partner_fee entries

    for (const t of rows) {
      const amt = Number(t.amount)
      const delta = t.type === 'income' ? amt : -amt
      b += delta
      out.push({ ...t, runningBalance: b })

      if (t.type === 'income') {
        totalIncome += amt
      } else if (t.category === 'partner_fee') {
        totalPartnerFee += amt
      } else {
        totalExpenseOps += amt
      }
    }

    // For partner-owned cars: use recorded partner_fee rows if present, otherwise calculate.
    // For rental-owned cars: no management fee applies.
    const feeRental = isPartnerCar
      ? (totalPartnerFee > 0
          ? totalPartnerFee
          : Math.round((totalIncome - totalExpenseOps) * feePct / 100))
      : 0
    const nettForPartner = totalIncome - totalExpenseOps - feeRental

    const filtered = out.filter((t) => {
      if (!matchesKeyword(t, keyword)) return false
      if (typeFilter && t.type !== typeFilter) return false
      if (categoryFilter && t.category !== categoryFilter) return false
      if (autoFeeFilter === 'yes' && !t.auto_fee) return false
      if (autoFeeFilter === 'no' && t.auto_fee) return false
      return true
    })

    const tableFiltersActive =
      Boolean(keyword.trim()) || Boolean(typeFilter) || Boolean(categoryFilter) || Boolean(autoFeeFilter)

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
  }, [rows, keyword, typeFilter, categoryFilter, autoFeeFilter, feePct, isPartnerCar])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setTypeFilter('')
    setCategoryFilter('')
    setAutoFeeFilter('')
    setExpanded(false)
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
      { field: 'category', headerName: 'Kategori', width: 120 },
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
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
        <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
          <InputLabel id="car-tx">Kendaraan</InputLabel>
          <Select labelId="car-tx" label="Kendaraan" value={carId} onChange={(e) => setCarId(e.target.value)}>
            {cars.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          type="month"
          label="Bulan"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          size="small"
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}
        />
      </Box>

      {carId ? (
        <InternalDataGridSearchPanel
          keyword={keyword}
          onKeywordChange={setKeyword}
          expanded={expanded}
          onExpandedToggle={() => setExpanded((x) => !x)}
          onSubmit={handleSearch}
          onClear={handleClear}
          onCollapseExpanded={() => setExpanded(false)}
          searchPlaceholder="Cari tipe, kategori, jumlah, catatan…"
          loading={loading}
          expandedContent={
            <>
              <TextField
                select
                fullWidth
                size="small"
                label="Tipe"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as '' | TransactionType)}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>Semua</em>
                </MenuItem>
                <MenuItem value="income">Pemasukan</MenuItem>
                <MenuItem value="expense">Pengeluaran</MenuItem>
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Kategori"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as '' | TransactionCategory)}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>Semua</em>
                </MenuItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Biaya otomatis"
                value={autoFeeFilter}
                onChange={(e) => setAutoFeeFilter(e.target.value as '' | 'yes' | 'no')}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>Semua</em>
                </MenuItem>
                <MenuItem value="yes">Otomatis saja</MenuItem>
                <MenuItem value="no">Manual saja</MenuItem>
              </TextField>
            </>
          }
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

      {carId && gridRows.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            Rincian Keuangan — {month}
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
