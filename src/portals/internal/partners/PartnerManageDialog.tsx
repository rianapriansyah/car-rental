import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DangerZone } from '../../../components/DangerZone'
import { supabase } from '../../../lib/supabase'
import { invitePartner } from '../../../lib/invitePartner'
import { deletePartner } from '../../../lib/deletePartner'
import type { PartnerRow } from '../../../types/partner'

type Props = {
  open: boolean
  partner: PartnerRow | null
  onClose: () => void
  onSaved: () => void
}

export function PartnerManageDialog({ open, partner, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    if (!open || !partner) return
    setName(partner.name ?? '')
    setEmail(partner.email ?? '')
    setPhone(partner.phone ?? '')
    setNotes(partner.notes ?? '')
    setError(null)
    setConfirmDeleteOpen(false)
  }, [open, partner])

  const handleClose = () => {
    if (saving || resending || deleting) return
    onClose()
  }

  async function handleSave() {
    if (!partner) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format email tidak valid.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: uErr } = await supabase
      .from('v2_partners')
      .update({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .eq('id', partner.id)
    setSaving(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    onSaved()
    onClose()
  }

  async function handleResend() {
    if (!partner) return
    setResending(true)
    setError(null)
    const result = await invitePartner({
      name: name.trim() || partner.name,
      email: email.trim() || partner.email,
      phone: phone.trim() || partner.phone,
      notes: notes.trim() || partner.notes,
    })
    setResending(false)
    if (!result.ok) {
      setError(`Undangan gagal: ${result.message}`)
      return
    }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!partner) return
    setDeleting(true)
    setError(null)
    const result = await deletePartner(partner.id)
    setDeleting(false)
    setConfirmDeleteOpen(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onSaved()
    onClose()
  }

  if (!partner) return null

  return (
    <>
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Ubah mitra</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <TextField
              size="small"
              label="Nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              size="small"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
          </Box>
          <TextField
            size="small"
            label="Telepon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label="Catatan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
          {!partner.verified ? (
            <Button variant="outlined" disabled={resending || saving} onClick={() => void handleResend()}>
              {resending ? 'Mengirim…' : 'Kirim ulang undangan'}
            </Button>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={handleClose} disabled={saving || resending || deleting}>
          Batal
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || resending || deleting}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
      <Box sx={{ px: 3, pb: 2, pt: 2 }}>
        <DangerZone
          title="Zona bahaya"
          description="Menghapus mitra akan memindahkan kendaraan terkait dan menghapus akun terhubung jika ada."
          actionLabel="Hapus mitra"
          disabled={deleting || saving}
          onAction={() => setConfirmDeleteOpen(true)}
        />
      </Box>
    </Dialog>
    <ConfirmDialog
      open={confirmDeleteOpen}
      title="Hapus mitra?"
      description={`Anda yakin ingin menghapus "${partner.name}"? Tindakan ini tidak dapat dibatalkan.`}
      confirmLabel={deleting ? 'Menghapus…' : 'Hapus'}
      onCancel={() => !deleting && setConfirmDeleteOpen(false)}
      onConfirm={() => void handleDelete()}
    />
    </>
  )
}
