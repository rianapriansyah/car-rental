import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { AddSettingDialog } from './AddSettingDialog'
import { EditSettingDialog } from './EditSettingDialog'
import {
  formatSettingValue,
  settingSearchBlob,
  type SettingRow,
} from './settingHelpers'

type SettingGridRow = SettingRow & { id: string }

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SettingRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase.from('v2_app_settings').select('*').order('key')
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as SettingRow[])
  }, [])

  useEffect(() => { void load() }, [load])

  function openEdit(row: SettingRow) {
    setEditTarget(row)
    setError(null)
  }

  const filteredDisplayRows = useMemo(
    () => rows.filter((r) => matchesSearchTokens(settingSearchBlob(r), keyword)),
    [rows, keyword],
  )

  const gridRows: SettingGridRow[] = useMemo(
    () => filteredDisplayRows.map((r) => ({ ...r, id: r.key })),
    [filteredDisplayRows],
  )

  const columns: GridColDef<SettingGridRow>[] = useMemo(
    () => [
      { field: 'key', headerName: 'Kunci', width: 180 },
      {
        field: 'description',
        headerName: 'Deskripsi',
        flex: 1,
        minWidth: 140,
        valueGetter: (_v, row) => row.description ?? '—',
      },
      {
        field: 'value',
        headerName: 'Nilai saat ini',
        width: 150,
        renderCell: (params) => (
          <Tooltip title={params.row.value} placement="top">
            <span>{formatSettingValue(params.row.key, params.row.value)}</span>
          </Tooltip>
        ),
      },
      {
        field: 'action',
        headerName: '',
        width: 60,
        align: 'center',
        headerAlign: 'center',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              openEdit(params.row)
            }}
            aria-label="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Pengaturan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Nilai fee dibaca oleh database saat menyelesaikan sewa. Jangan diubah langsung di kode aplikasi.
        Nama perusahaan di PDF diambil dari kunci <strong>company_name</strong>.
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari kunci, deskripsi, nilai…"
        loading={loading}
      />

      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

      {!loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            mb: 2,
            mt: error ? 1 : 0,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            sx={{ maxWidth: { xs: '100%', sm: 200 } }}
            onClick={() => setAddOpen(true)}
          >
            Tambah pengaturan
          </Button>
        </Box>
      ) : null}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : gridRows.length === 0 ? (
        <Typography color="text.secondary">Tidak ada pengaturan yang sesuai.</Typography>
      ) : (
        <Paper sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }} variant="outlined">
          <DataGrid
            rows={gridRows}
            columns={columns}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            autoHeight
            sx={{ border: 'none', cursor: 'pointer' }}
            onRowClick={({ row }) => openEdit(row as SettingGridRow)}
          />
        </Paper>
      )}

      <EditSettingDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => void load()}
        onError={setError}
      />

      <AddSettingDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => void load()}
        onError={setError}
      />
    </Box>
  )
}
