import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import type { CarWithPartner } from '../../../types/car'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { CarFormDialog } from './CarFormDialog.tsx'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { getCarStatusChipProps, statusChipSx } from '../../../lib/statusChips'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function carSearchBlob(row: CarWithPartner): string {
  const partner = row.v2_partners?.name ?? ''
  const ownership =
    row.ownership_type === 'partner'
      ? 'mitra partner'
      : 'rental perusahaan'
  const status =
    row.status === 'available'
      ? 'tersedia available'
      : row.status === 'inactive'
        ? 'tidak aktif inactive'
        : 'disewa rented'
  return `${row.name} ${row.plate} ${partner} ${row.ownership_type ?? ''} ${ownership} ${row.status} ${status}`.toLowerCase()
}

export function CarsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<CarWithPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')

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
    return rows.filter((row) => matchesSearchTokens(carSearchBlob(row), keyword))
  }, [rows, keyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setIncludeDeleted(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<CarWithPartner>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Nama', flex: 1, minWidth: 140 },
      { field: 'plate', headerName: 'Plat', width: 120 },
      {
        field: 'daily_rate',
        headerName: 'Tarif Harian',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => row.daily_rate != null ? formatIdr(row.daily_rate) : '—',
      },
      { field: 'ownership_type', headerName: 'Kepemilikan', width: 130 },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => {
          const { label, color } = getCarStatusChipProps(params.row.status)
          return <Chip size="small" label={label} color={color} sx={statusChipSx} />
        },
      },
      {
        field: 'actions',
        headerName: 'Aksi',
        width: 72,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <DataGridUpdateIconButton
            onClick={() => {
              navigate(`/internal/cars/${params.row.id}`)
            }}
          />
        ),
      },
    ],
    [navigate],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 1 }}>
        Kendaraan
      </Typography>
      <FormControlLabel
        sx={{ display: 'block', mb: 2 }}
        control={
          <Switch checked={includeDeleted} onChange={(_, v) => setIncludeDeleted(v)} size="small" />
        }
        label="Tampilkan yang dihapus"
      />

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari nama, plat, mitra, kepemilikan, status…"
        loading={loading}
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => setDialogOpen(true)}
        >
          Tambah kendaraan
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">Belum ada kendaraan.</Typography>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            {loading ? 'Memuat…' : `${filteredRows.length} kendaraan`}
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
              onRowClick={(params) => {
                navigate(`/internal/cars/${params.id}`)
              }}
              getRowClassName={(params) => (params.row.deleted_at ? 'cars-row-deleted' : '')}
              sx={{
                border: 'none',
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                '& .cars-row-deleted': { opacity: 0.5 },
              }}
            />
          </Paper>
        </Box>
      )}
      <CarFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => void load()} />
    </Box>
  )
}
