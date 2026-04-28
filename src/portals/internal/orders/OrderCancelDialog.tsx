import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'

type Props = {
  open: boolean
  orderId: string | null
  onClose: () => void
  onCancelled: () => void
  onError: (message: string) => void
}

export function OrderCancelDialog({ open, orderId, onClose, onCancelled, onError }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setBusy(false)
    }
  }, [open])

  const requestClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    if (!orderId) return
    const trimmed = reason.trim()
    if (!trimmed) {
      onError('Alasan pembatalan wajib diisi.')
      return
    }
    setBusy(true)
    const { error: uErr } = await supabase
      .from('v2_orders')
      .update({
        status: 'cancelled',
        cancel_reason: trimmed,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    setBusy(false)
    if (uErr) {
      onError(uErr.message)
      return
    }
    onCancelled()
    onClose()
  }

  return (
    <Dialog open={open} onClose={requestClose} fullWidth maxWidth="sm">
      <DialogTitle>Batalkan pesanan</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          margin="dense"
          label="Alasan pembatalan"
          fullWidth
          multiline
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={requestClose} disabled={busy}>
          Tutup
        </Button>
        <Button variant="contained" color="error" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan pembatalan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
