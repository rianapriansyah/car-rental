import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { invitePartner } from '../../../lib/invitePartner'
import { deletePartner } from '../../../lib/deletePartner'
import type { PartnerRow } from '../../../types/partner'
import { PartnerFormDialog } from './PartnerFormDialog.tsx'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function matchesKeyword(row: PartnerRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.name} ${row.email} ${row.phone ?? ''}`.toLowerCase()
  return blob.includes(s)
}

export function PartnersPage() {
  const [rows, setRows] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase.from('v2_partners').select('*').order('name')
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resendInvite = useCallback(
    async (row: PartnerRow) => {
      setInvitingId(row.id)
      setError(null)
      const result = await invitePartner({ name: row.name, email: row.email, phone: row.phone, notes: row.notes })
      setInvitingId(null)
      if (!result.ok) {
        setError(`Undangan gagal: ${result.message}`)
        return
      }
      void load()
    },
    [load],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    const result = await deletePartner(deleteTarget.id, deleteTarget.auth_user_id)
    setDeleting(false)
    if (!result.ok) {
      setError(result.message)
      setDeleteTarget(null)
      return
    }
    setDeleteTarget(null)
    void load()
  }, [deleteTarget, load])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesKeyword(row, keyword)) return false
      if (statusFilter === 'verified' && !row.verified) return false
      if (statusFilter === 'pending' && row.verified) return false
      return true
    })
  }, [rows, keyword, statusFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setStatusFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<PartnerRow>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Nama', flex: 1, minWidth: 140 },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
      {
        field: 'phone',
        headerName: 'Telepon',
        width: 140,
        valueGetter: (_v, row) => row.phone ?? '—',
      },
      {
        field: 'verified',
        headerName: 'Status',
        width: 160,
        renderCell: (params) => {
          if (params.row.verified) {
            return <Chip size="small" label="Terverifikasi" color="success" variant="outlined" />
          }
          if (params.row.auth_user_id) {
            return <Chip size="small" label="Terhubung" color="primary" variant="outlined" />
          }
          return <Chip size="small" label="Menunggu verifikasi" color="default" variant="outlined" />
        },
      },
      {
        field: 'actions',
        headerName: 'Aksi',
        width: 220,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}>
            {!params.row.verified && (
              <Button
                size="small"
                disabled={invitingId === params.row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  void resendInvite(params.row)
                }}
              >
                {invitingId === params.row.id ? 'Mengirim…' : 'Kirim ulang'}
              </Button>
            )}
            <Button
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(params.row)
              }}
            >
              Hapus
            </Button>
          </Box>
        ),
      },
    ],
    [invitingId, resendInvite],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Mitra
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        onCollapseExpanded={() => setExpanded(false)}
        searchPlaceholder="Cari nama, email, telepon…"
        loading={loading}
        expandedContent={
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
              <em>Semua</em>
            </MenuItem>
            <MenuItem value="verified">Terverifikasi</MenuItem>
            <MenuItem value="pending">Menunggu verifikasi</MenuItem>
          </TextField>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button variant="contained" fullWidth sx={{ maxWidth: { xs: '100%', sm: 200 } }} onClick={() => setDialogOpen(true)}>
          Tambah mitra
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">Belum ada mitra.</Typography>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            {loading ? 'Memuat…' : `${filteredRows.length} mitra`}
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
              sx={{ border: 'none' }}
            />
          </Paper>
        </Box>
      )}
      <PartnerFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => void load()} />

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Hapus mitra?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Batal
          </Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void handleDelete()}>
            {deleting ? 'Menghapus…' : 'Hapus'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
