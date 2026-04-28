import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { supabase } from '../../../lib/supabase'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { getRenterAccountChipProps, statusChipSx } from '../../../lib/statusChips'
import type { Tables } from '../../../types/database'
import { RenterInfoFormDialog } from './RenterInfoFormDialog'

type RenterInfo = Tables<'v2_renter_info'>

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function statusChip(status: string) {
  const { label, color } = getRenterAccountChipProps(status)
  return <Chip size="small" label={label} color={color} sx={statusChipSx} />
}

function renterInfoSearchBlob(row: RenterInfo): string {
  const st = row.status === 'blacklisted' ? 'diblokir blacklisted' : 'aktif active'
  return `${row.name} ${row.phone ?? ''} ${row.notes ?? ''} ${row.status} ${st}`.toLowerCase()
}

export function RenterInfoPage() {
  const [rows, setRows] = useState<RenterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RenterInfo | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('v2_renter_info')
      .select('*')
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  function handleClear() {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => matchesSearchTokens(renterInfoSearchBlob(r), keyword))
  }, [rows, keyword])

  const columns: GridColDef<RenterInfo>[] = [
    { field: 'name', headerName: 'Nama', flex: 1.2, minWidth: 140 },
    { field: 'phone', headerName: 'Telepon', flex: 1, minWidth: 130, valueGetter: (v) => v ?? '—' },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (p) => statusChip(p.value as string),
    },
    { field: 'notes', headerName: 'Catatan', flex: 2, minWidth: 180, valueGetter: (v) => v ?? '—' },
    {
      field: '_actions',
      headerName: 'Aksi',
      width: 72,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (p) => (
        <DataGridUpdateIconButton
          onClick={() => {
            setEditing(p.row)
            setDialogOpen(true)
          }}
        />
      ),
    },
  ]

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 3 }}>
        Info Penyewa
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari nama, telepon, catatan, status…"
        loading={loading}
      />

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          Tambah penyewa
        </Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <DataGrid
        rows={filtered}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        disableRowSelectionOnClick
        autoHeight
      />

      <RenterInfoFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </Box>
  )
}
