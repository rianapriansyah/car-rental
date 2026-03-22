import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { completeRentalWithIncome } from '../../../lib/feeEngine'

type Props = {
  open: boolean
  rentalId: string | null
  onClose: () => void
  onCompleted: () => void
}

export function CompleteRentalDialog({ open, rentalId, onClose, onCompleted }: Props) {
  const [gross, setGross] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    if (!rentalId) return
    const n = Number(gross.replace(/\D/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid gross income amount (IDR).')
      return
    }
    setBusy(true)
    setError(null)
    const { error: doneError } = await completeRentalWithIncome(rentalId, n)
    setBusy(false)
    if (doneError) {
      setError(doneError.message)
      return
    }
    setGross('')
    onCompleted()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Complete rental</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <TextField
          size="small"
          label="Gross income (IDR)"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          fullWidth
          helperText="Fees are calculated in the database via complete_rental."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !rentalId}>
          {busy ? 'Completing…' : 'Complete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
