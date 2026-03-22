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
import { useDialogFullScreen } from '../../../hooks/useDialogFullScreen'
import { completeRentalWithIncome } from '../../../lib/feeEngine'

type Props = {
  open: boolean
  rentalId: string | null
  onClose: () => void
  onCompleted: () => void
}

export function CompleteRentalDialog({ open, rentalId, onClose, onCompleted }: Props) {
  const fullScreen = useDialogFullScreen()
  const [gross, setGross] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle>Complete rental</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Gross income (IDR)"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
          helperText="Fees are calculated in the database via complete_rental."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !rentalId}>
          Complete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
