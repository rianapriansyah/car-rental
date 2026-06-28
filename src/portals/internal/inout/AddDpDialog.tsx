import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
} from '@mui/material'
import { formatIdr } from '../../../lib/formatIdr'

type Props = {
  open: boolean
  currentDownPayment: number
  onClose: () => void
  /**
   * Persist the additional DP. Resolve to `null` on success, otherwise
   * return an error message that will be shown inside the dialog.
   */
  onSubmit: (amount: number) => Promise<string | null>
}

export function AddDpDialog({ open, currentDownPayment, onClose, onSubmit }: Props) {
  const [additionalDp, setAdditionalDp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setAdditionalDp('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const requestClose = () => {
    if (busy) return
    onClose()
  }

  async function handleSubmit() {
    const addAmount = Number(additionalDp.replace(/\D/g, '') || 0)
    if (!Number.isFinite(addAmount) || addAmount <= 0) {
      setError('Masukkan jumlah DP tambahan lebih dari 0 (IDR).')
      return
    }
    setBusy(true)
    setError(null)
    const errMsg = await onSubmit(addAmount)
    setBusy(false)
    if (errMsg) {
      setError(errMsg)
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={requestClose} fullWidth maxWidth="xs">
      <DialogTitle>Tambah DP</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Mencatat transaksi DP sewa dan menambah total DP pada sewa ini tanpa menyelesaikan checkout.
          {' '}DP saat ini: <strong>{formatIdr(currentDownPayment)}</strong>
        </DialogContentText>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Jumlah DP tambahan"
          value={additionalDp ? additionalDp.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
          onChange={(e) => {
            setAdditionalDp(e.target.value.replace(/\D/g, ''))
            if (error) setError(null)
          }}
          inputMode="numeric"
          disabled={busy}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment> } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={requestClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={busy || !additionalDp.replace(/\D/g, '')}
        >
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
