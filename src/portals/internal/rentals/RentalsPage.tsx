import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PrintIcon from '@mui/icons-material/Print'
import {
  Alert,
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import type { RentalWithCar } from '../../../types/rental'
import { CompleteRentalDialog } from './CompleteRentalDialog'
import { RentalReceiptDialog } from './RentalReceiptDialog'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type CarOption = { id: string; name: string; plate: string }

const STATUS_LABELS: Record<string, string> = { active: 'Aktif', completed: 'Selesai', cancelled: 'Dibatalkan' }

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

function monthOptionsForYear(year: number) {
  const now = new Date()
  const currentMm =
    now.getFullYear() === year ? String(now.getMonth() + 1).padStart(2, '0') : null
  return MONTH_NAMES_ID.map((name, i) => {
    const value = String(i + 1).padStart(2, '0')
    return {
      value,
      label: `${name} ${year}`,
      isCurrentMonth: currentMm === value,
    }
  })
}

function rentalMatchesCarAndMonth(row: RentalWithCar, carId: string, monthYyyyMm: string): boolean {
  if (carId && row.car_id !== carId) return false
  const startMonth = row.start_date.slice(0, 7)
  if (monthYyyyMm && startMonth !== monthYyyyMm) return false
  return true
}

function calcDurationLabel(row: RentalWithCar): string {
  if (row.status === 'cancelled') return '—'
  const start = new Date(row.start_date)
  const end = row.end_date ? new Date(row.end_date) : new Date()
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (row.status === 'active') return `${days} hari (aktif)`
  return `${days} hari`
}

function rentalSearchBlob(row: RentalWithCar): string {
  const car = row.v2_cars ? `${row.v2_cars.name} ${row.v2_cars.plate}` : ''
  const statusLabel = STATUS_LABELS[row.status] ?? row.status
  return `${row.renter_name} ${car} ${statusLabel} ${row.status}`.toLowerCase()
}

function completionLabel(row: RentalWithCar): string {
  if (!row.end_date) return '—'
  return row.end_time ? `${row.end_date} ${row.end_time}` : row.end_date
}

export function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rentalIdParam = searchParams.get('rentalId')
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  /** '' = semua bulan; '01'…'12' = bulan pada tahun berjalan */
  const [monthMm, setMonthMm] = useState('')
  const filterYear = new Date().getFullYear()
  const scopeMonthYyyyMm = monthMm ? `${filterYear}-${monthMm}` : ''
  const [rows, setRows] = useState<RentalWithCar[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completeRental, setCompleteRental] = useState<RentalWithCar | null>(null)
  const [receiptRental, setReceiptRental] = useState<RentalWithCar | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name, plate')
      .is('deleted_at', null)
      .order('name')
    if (qError) {
      console.error(qError)
      return
    }
    const list = (data ?? []) as CarOption[]
    setCars(list)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('v2_rentals').select('*, v2_cars(name, plate)').order('start_date', { ascending: false })
    if (rentalIdParam) {
      q = q.eq('id', rentalIdParam)
    }
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as RentalWithCar[])
  }, [rentalIdParam])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }, [carId, monthMm])

  const filteredRows = useMemo(() => {
    const byScope = rentalIdParam
      ? rows
      : rows.filter((row) => rentalMatchesCarAndMonth(row, carId, scopeMonthYyyyMm))
    return byScope.filter((row) => matchesSearchTokens(rentalSearchBlob(row), keyword))
  }, [rows, carId, scopeMonthYyyyMm, keyword, rentalIdParam])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
    setSearchParams({}, { replace: true })
  }

  const dismissRentalHighlight = () => {
    setSearchParams({}, { replace: true })
  }

  const columns: GridColDef<RentalWithCar>[] = useMemo(
    () => [
      {
        field: 'car',
        headerName: 'Kendaraan',
        flex: 1,
        minWidth: 200,
        valueGetter: (_v, row) =>
          row.v2_cars ? `${row.v2_cars.name} (${row.v2_cars.plate})` : '—',
      },
      { field: 'renter_name', headerName: 'Penyewa', width: 160 },
      { field: 'start_date', headerName: 'Mulai', width: 120 },
      {
        field: 'completed_at',
        headerName: 'Selesai',
        width: 145,
        valueGetter: (_v, row) => completionLabel(row),
      },
      {
        field: 'duration',
        headerName: 'Durasi',
        width: 140,
        valueGetter: (_v, row) => calcDurationLabel(row),
      },
      {
        field: 'down_payment',
        headerName: 'DP',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => row.down_payment != null && row.down_payment > 0 ? formatIdr(Number(row.down_payment)) : '—',
      },
      {
        field: 'gross_income',
        headerName: 'Pendapatan Kotor',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => row.gross_income != null ? formatIdr(Number(row.gross_income)) : '—',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => (
          <Chip size="small" label={STATUS_LABELS[params.row.status] ?? params.row.status} sx={{ my: 0.5 }} />
        ),
      },
      {
        field: 'is_manual',
        headerName: 'Manual',
        width: 100,
        valueGetter: (_v, row) => (row.is_manual ? 'Ya' : 'Tidak'),
      },
      {
        field: 'actions',
        headerName: 'Aksi',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.25} justifyContent="flex-end" sx={{ pr: 0.5 }}>
            {params.row.status === 'completed' ? (
              <Tooltip title="Cetak kuitansi">
                <IconButton
                  size="small"
                  aria-label="Cetak kuitansi"
                  onClick={(e) => {
                    e.stopPropagation()
                    setReceiptRental(params.row)
                  }}
                  sx={{ my: 0.5 }}
                >
                  <PrintIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {params.row.status === 'active' ? (
              <DataGridUpdateIconButton
                title="Selesaikan sewa"
                onClick={() => setCompleteRental(params.row)}
              />
            ) : null}
          </Stack>
        ),
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Sewa
      </Typography>

      {rentalIdParam ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={dismissRentalHighlight}>
          Menampilkan sewa yang baru diaktifkan dari pesanan.
        </Alert>
      ) : null}

      {!rentalIdParam ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
          <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
            <InputLabel id="rental-car-filter">Kendaraan</InputLabel>
            <Select
              labelId="rental-car-filter"
              label="Kendaraan"
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
            >
              <MenuItem value="">
                <em>Semua Kendaraan</em>
              </MenuItem>
              {cars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.plate ? `${c.name} (${c.plate})` : c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
            <InputLabel id="rental-month-filter">Bulan</InputLabel>
            <Select
              labelId="rental-month-filter"
              label="Bulan"
              value={monthMm}
              onChange={(e) => setMonthMm(e.target.value)}
            >
              <MenuItem value="">
                <em>Semua Bulan</em>
              </MenuItem>
              {monthOptionsForYear(filterYear).map((m) => (
                <MenuItem
                  key={m.value}
                  value={m.value}
                  sx={m.isCurrentMonth ? { fontWeight: 600 } : undefined}
                >
                  {m.label}
                  {m.isCurrentMonth ? (
                    <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                      · bulan ini
                    </Typography>
                  ) : null}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ) : null}

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari penyewa, kendaraan, plat, status…"
        loading={loading}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">Tidak ada sewa yang sesuai.</Typography>
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
            rows={filteredRows}
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
      <CompleteRentalDialog
        open={completeRental !== null}
        rentalId={completeRental?.id ?? null}
        downPayment={Number(completeRental?.down_payment ?? 0)}
        checkInNote={completeRental?.manual_note}
        onClose={() => setCompleteRental(null)}
        onCompleted={() => void load()}
      />
      <RentalReceiptDialog
        open={receiptRental !== null}
        rental={receiptRental}
        onClose={() => setReceiptRental(null)}
      />
    </Box>
  )
}
