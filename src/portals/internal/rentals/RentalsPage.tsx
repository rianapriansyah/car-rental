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
import type { RentalWithCar } from '../../../types/rental'
import { RentalFormDialog } from './RentalFormDialog'
import { CompleteRentalDialog } from './CompleteRentalDialog'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type CarFilter = { id: string; name: string }

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
  const [formOpen, setFormOpen] = useState(false)
  const [completeId, setCompleteId] = useState<string | null>(null)
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
        headerName: 'Car',
        flex: 1,
        minWidth: 200,
        valueGetter: (_v, row) =>
          row.v2_cars ? `${row.v2_cars.name} (${row.v2_cars.plate})` : '—',
      },
      { field: 'renter_name', headerName: 'Renter', width: 160 },
      { field: 'start_date', headerName: 'Start', width: 120 },
      {
        field: 'end_date',
        headerName: 'End',
        width: 120,
        valueGetter: (_v, row) => row.end_date ?? '—',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => <Chip size="small" label={params.row.status} sx={{ my: 0.5 }} />,
      },
      {
        field: 'is_manual',
        headerName: 'Manual',
        width: 100,
        valueGetter: (_v, row) => (row.is_manual ? 'Yes' : 'No'),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 120,
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
                setCompleteId(params.row.id)
              }}
            >
              Complete
            </Button>
          ) : null,
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Rentals
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Search renter, car, plate…"
        loading={loading}
        expandedContent={
          <>
            <TextField
              select
              fullWidth
              size="small"
              label="Car"
              value={draftCarFilter}
              onChange={(e) => setDraftCarFilter(e.target.value)}
            >
              <MenuItem value="">
                <em>All</em>
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
                <em>All</em>
              </MenuItem>
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button variant="contained" fullWidth sx={{ maxWidth: { xs: '100%', sm: 220 } }} onClick={() => setFormOpen(true)}>
          Start rental
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">No rentals match the filters.</Typography>
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
      <RentalFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void load()} />
      <CompleteRentalDialog
        open={completeId !== null}
        rentalId={completeId}
        onClose={() => setCompleteId(null)}
        onCompleted={() => void load()}
      />
    </Box>
  )
}
