import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'

type RenterInfo = Tables<'v2_renter_info'>

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'blacklisted', label: 'Diblokir' },
]

function statusChip(status: string) {
  if (status === 'blacklisted') return <Chip size="small" label="Diblokir" color="error" />
  return <Chip size="small" label="Aktif" color="success" />
}

function matchesKeyword(row: RenterInfo, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.name} ${row.phone ?? ''} ${row.notes ?? ''}`.toLowerCase()
  return blob.includes(s)
}

// ─── FORM DIALOG ─────────────────────────────────────────────────────────────

type FormDialogProps = {
  open: boolean
  initial: RenterInfo | null
  onClose: () => void
  onSaved: () => void
}

function RenterInfoFormDialog({ open, initial, onClose, onSaved }: FormDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setPhone(initial?.phone ?? '')
      setStatus(initial?.status ?? 'active')
      setNotes(initial?.notes ?? '')
      setError(null)
    }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nama wajib diisi.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      status,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let err
    if (initial) {
      ;({ error: err } = await supabase.from('v2_renter_info').update(payload).eq('id', initial.id))
    } else {
      ;({ error: err } = await supabase.from('v2_renter_info').insert(payload))
    }

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Ubah info penyewa' : 'Tambah info penyewa'}</DialogTitle>
      <DialogContent>
        <Box component="form" id="renter-info-form" onSubmit={(e) => void handleSubmit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            size="small"
            label="Nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            size="small"
            label="Nomor HP"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            placeholder="mis. 081234567890"
          />
          <TextField
            size="small"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            select
            fullWidth
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Catatan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            placeholder="mis. Diblokir karena kerusakan kendaraan."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Batal</Button>
        <Button type="submit" form="renter-info-form" variant="contained" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export function RenterInfoPage() {
  const [rows, setRows] = useState<RenterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RenterInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RenterInfo | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

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

  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setAppliedKeyword(keyword)
    setAppliedStatus(statusFilter)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  function handleClear() {
    setKeyword('')
    setStatusFilter('')
    setAppliedKeyword('')
    setAppliedStatus('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (appliedStatus && r.status !== appliedStatus) return false
      if (!matchesKeyword(r, appliedKeyword)) return false
      return true
    })
  }, [rows, appliedKeyword, appliedStatus])

  const collapseExpanded = useCallback(() => setExpanded(false), [])

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('v2_renter_info').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    void load()
  }

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
      headerName: '',
      width: 130,
      sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
          <Button
            size="small"
            onClick={() => {
              setEditing(p.row)
              setDialogOpen(true)
            }}
          >
            Ubah
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(p.row)}>
            Hapus
          </Button>
        </Box>
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
        expanded={expanded}
        onExpandedToggle={() => setExpanded((v) => !v)}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari nama, telepon, atau catatan…"
        loading={loading}
        onCollapseExpanded={collapseExpanded}
        expandedContent={
          <TextField
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            select
            fullWidth
            slotProps={{ select: searchPanelSelectSlotProps(collapseExpanded) }}
          >
            <MenuItem value="">Semua status</MenuItem>
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        }
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
        density="compact"
      />

      <RenterInfoFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus info penyewa"
        description={`Hapus "${deleteTarget?.name ?? ''}" dari info penyewa? Tindakan ini tidak bisa dibatalkan.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}
