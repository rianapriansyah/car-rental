import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DangerZone } from '../../../components/DangerZone'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'

type RenterInfo = Tables<'v2_renter_info'>

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'blacklisted', label: 'Diblokir' },
]

type Props = {
  open: boolean
  initial: RenterInfo | null
  onClose: () => void
  onSaved: () => void
}

export function RenterInfoFormDialog({ open, initial, onClose, onSaved }: Props) {
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
        <DialogContent dividers>
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
