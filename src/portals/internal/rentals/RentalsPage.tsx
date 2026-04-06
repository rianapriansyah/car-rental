import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import PrintIcon from '@mui/icons-material/Print'
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { InternalCarMonthFilter } from '../../../components/InternalCarMonthFilter'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import type { RentalWithCar } from '../../../types/rental'
import { CompleteRentalDialog } from './CompleteRentalDialog'
import { RentalReceiptDialog } from './RentalReceiptDialog'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { getRentalStatusChipProps, RENTAL_STATUS_LABELS, statusChipSx } from '../../../lib/statusChips'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type CarOption = { id: string; name: string; plate: string }

function rentalMatchesCarAndMonth(row: RentalWithCar, carId: string, monthYyyyMm: string): boolean {
  if (carId && row.car_id !== carId) return false
  const startMonth = row.start_date.slice(0, 7)
  if (monthYyyyMm && startMonth !== monthYyyyMm) return false
  return true
}

const MINUTES_PER_DAY = 24 * 60

function calcDurationLabel(row: RentalWithCar): string {
  if (row.status === 'cancelled') return '—'
  const startT = row.start_time?.trim() || '00:00'
  const start = dayjs(`${row.start_date}T${startT}`)
  const end = row.end_date
    ? dayjs(`${row.end_date}T${row.end_time?.trim() || '23:59'}`)
    : dayjs()
  const totalMinutes = Math.max(0, end.diff(start, 'minute'))
  if (totalMinutes === 0) return '—'
  if (totalMinutes < MINUTES_PER_DAY) {
    const jam = Math.max(1, Math.ceil(totalMinutes / 60))
    return row.status === 'active' ? `${jam} jam (aktif)` : `${jam} jam`
  }
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  return row.status === 'active' ? `${days} hari (aktif)` : `${days} hari`
}

function rentalSearchBlob(row: RentalWithCar): string {
  const car = row.v2_cars ? `${row.v2_cars.name} ${row.v2_cars.plate}` : ''
  const statusLabel = RENTAL_STATUS_LABELS[row.status] ?? row.status
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
  const [month, setMonth] = useState(() => dayjs().startOf('month'))
  const scopeMonthYyyyMm = month.format('YYYY-MM')
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
  }, [carId, month])

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
        renderCell: (params) => {
          const { label, color } = getRentalStatusChipProps(params.row.status)
          return <Chip size="small" label={label} color={color} sx={statusChipSx} />
        },
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
        <InternalCarMonthFilter
          cars={cars}
          carId={carId}
          onCarIdChange={setCarId}
          month={month}
          onMonthChange={setMonth}
          allowAllCars
        />
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
        carId={completeRental?.car_id ?? null}
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
