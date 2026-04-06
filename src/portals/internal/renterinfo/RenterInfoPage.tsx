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
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DangerZone } from '../../../components/DangerZone'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { supabase } from '../../../lib/supabase'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { getRenterAccountChipProps, statusChipSx } from '../../../lib/statusChips'
import type { Tables } from '../../../types/database'

type RenterInfo = Tables<'v2_renter_info'>

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'blacklisted', label: 'Diblokir' },
]

function statusChip(status: string) {
  const { label, color } = getRenterAccountChipProps(status)
  return <Chip size="small" label={label} color={color} sx={statusChipSx} />
}

function renterInfoSearchBlob(row: RenterInfo): string {
  const st = row.status === 'blacklisted' ? 'diblokir blacklisted' : 'aktif active'
  return `${row.name} ${row.phone ?? ''} ${row.notes ?? ''} ${row.status} ${st}`.toLowerCase()
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
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setPhone(initial?.phone ?? '')
      setStatus(initial?.status ?? 'active')
      setNotes(initial?.notes ?? '')
      setError(null)
      setConfirmDeleteOpen(false)
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

  async function handleDeleteConfirmed() {
    if (!initial) return
    setDeleting(true)
    setError(null)
    const { error: dErr } = await supabase.from('v2_renter_info').delete().eq('id', initial.id)
    setDeleting(false)
    setConfirmDeleteOpen(false)
    if (dErr) {
      setError(dErr.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <>
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
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose} disabled={saving || deleting}>Batal</Button>
        <Button type="submit" form="renter-info-form" variant="contained" disabled={saving || deleting}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
      {initial ? (
        <Box sx={{ px: 3, pb: 2, pt: 2 }}>
          <DangerZone
            title="Zona bahaya"
            description="Menghapus info penyewa tidak dapat dibatalkan."
            actionLabel="Hapus info penyewa"
            disabled={saving || deleting}
            onAction={() => setConfirmDeleteOpen(true)}
          />
        </Box>
      ) : null}
    </Dialog>
    <ConfirmDialog
      open={confirmDeleteOpen}
      title="Hapus info penyewa?"
      description={`Hapus "${initial?.name ?? ''}" dari info penyewa? Tindakan ini tidak bisa dibatalkan.`}
      onConfirm={() => void handleDeleteConfirmed()}
      onCancel={() => setConfirmDeleteOpen(false)}
      confirmLabel={deleting ? 'Menghapus…' : 'Hapus'}
    />
    </>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

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
