import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import type { CarWithPartner } from '../../../types/car'
import { CarFormDialog } from './CarFormDialog.tsx'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function matchesKeyword(row: CarWithPartner, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.name} ${row.plate} ${row.v2_partners?.name ?? ''}`.toLowerCase()
  return blob.includes(s)
}

export function CarsPage() {
  const [rows, setRows] = useState<CarWithPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CarWithPartner | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [plateFilter, setPlateFilter] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('v2_cars').select('*, v2_partners(name)').order('created_at', { ascending: false })
    if (!includeDeleted) {
      q = q.is('deleted_at', null)
    }
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as CarWithPartner[])
  }, [includeDeleted])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    const p = plateFilter.trim().toLowerCase()
    return rows.filter((row) => {
      if (!matchesKeyword(row, keyword)) return false
      if (p && !row.plate.toLowerCase().includes(p)) return false
      if (ownershipFilter && row.ownership_type !== ownershipFilter) return false
      if (statusFilter && row.status !== statusFilter) return false
      return true
    })
  }, [rows, keyword, plateFilter, ownershipFilter, statusFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPlateFilter('')
    setOwnershipFilter('')
    setStatusFilter('')
    setIncludeDeleted(false)
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<CarWithPartner>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
      { field: 'plate', headerName: 'Plate', width: 120 },
      { field: 'ownership_type', headerName: 'Ownership', width: 130 },
      {
        field: 'partner',
        headerName: 'Partner',
        flex: 1,
        minWidth: 120,
        valueGetter: (_v, row) => row.v2_partners?.name ?? '—',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.status}
            color={params.row.status === 'available' ? 'success' : 'warning'}
            sx={{ my: 0.5 }}
          />
        ),
      },
      {
        field: 'has_gps',
        headerName: 'GPS',
        width: 90,
        valueGetter: (_v, row) => (row.has_gps ? 'Yes' : 'No'),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(params.row)
              setDialogOpen(true)
            }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Cars
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        onCollapseExpanded={() => setExpanded(false)}
        searchPlaceholder="Search name, plate, partner…"
        loading={loading}
        expandedContent={
          <>
            <TextField
              fullWidth
              size="small"
              label="Plate"
              value={plateFilter}
              onChange={(e) => setPlateFilter(e.target.value)}
              placeholder="Contains…"
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Ownership"
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              <MenuItem value="rental">Rental (company)</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="rented">Rented</MenuItem>
            </TextField>
            <FormControlLabel
              sx={{ gridColumn: { xs: '1', sm: '1 / -1', md: '1 / -1' }, alignSelf: 'center', m: 0 }}
              control={
                <Switch checked={includeDeleted} onChange={(_, v) => setIncludeDeleted(v)} size="small" />
              }
              label="Include deleted cars"
            />
          </>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          Add car
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">No cars yet.</Typography>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            {loading ? 'Loading…' : `${filteredRows.length} car${filteredRows.length === 1 ? '' : 's'}`}
          </Typography>
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
              getRowClassName={(params) => (params.row.deleted_at ? 'cars-row-deleted' : '')}
              sx={{
                border: 'none',
                '& .cars-row-deleted': { opacity: 0.5 },
              }}
            />
          </Paper>
        </Box>
      )}
      <CarFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </Box>
  )
}
