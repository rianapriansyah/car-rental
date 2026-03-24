import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import type { RentalWithCar } from '../../../types/rental'
import { CompleteRentalDialog } from './CompleteRentalDialog'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const STATUS_LABELS: Record<string, string> = { active: 'Aktif', completed: 'Selesai', cancelled: 'Dibatalkan' }

type CarFilter = { id: string; name: string }

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
  return `${row.renter_name} ${car}`.toLowerCase()
}

export function RentalsPage() {
  const [rows, setRows] = useState<RentalWithCar[]>([])
  const [cars, setCars] = useState<CarFilter[]>([])
  const [draftCarFilter, setDraftCarFilter] = useState('')
  const [draftStatusFilter, setDraftStatusFilter] = useState('')
  const [appliedCarFilter, setAppliedCarFilter] = useState('')
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completeRental, setCompleteRental] = useState<RentalWithCar | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    if (!qError) {
      setCars(data ?? [])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('v2_rentals').select('*, v2_cars(name, plate)').order('start_date', { ascending: false })
    if (appliedCarFilter) {
      q = q.eq('car_id', appliedCarFilter)
    }
    if (appliedStatusFilter) {
      q = q.eq('status', appliedStatusFilter)
    }
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as RentalWithCar[])
  }, [appliedCarFilter, appliedStatusFilter])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(() => ['active', 'completed', 'cancelled'], [])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => rentalSearchBlob(row).includes(q))
  }, [rows, keyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedCarFilter(draftCarFilter)
    setAppliedStatusFilter(draftStatusFilter)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setDraftCarFilter('')
    setDraftStatusFilter('')
    setAppliedCarFilter('')
    setAppliedStatusFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
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
        width: 130,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) =>
          params.row.status === 'active' ? (
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                setCompleteRental(params.row)
              }}
            >
              Selesaikan
            </Button>
          ) : null,
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Sewa
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari penyewa, kendaraan, plat…"
        loading={loading}
        expandedContent={
          <>
            <TextField
              select
              fullWidth
              size="small"
              label="Kendaraan"
              value={draftCarFilter}
              onChange={(e) => setDraftCarFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>Semua</em>
              </MenuItem>
              {cars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={draftStatusFilter}
              onChange={(e) => setDraftStatusFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>Semua</em>
              </MenuItem>
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {STATUS_LABELS[s] ?? s}
                </MenuItem>
              ))}
            </TextField>
          </>
        }
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
    </Box>
  )
}
