import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { completeRentalWithIncome } from '../../../lib/feeEngine'
import { formatIdr } from '../../../lib/formatIdr'

type Props = {
  open: boolean
  rentalId: string | null
  downPayment: number
  checkInNote?: string | null
  onClose: () => void
  onCompleted: () => void
}

function buildCombinedNote(checkIn: string, checkOut: string): string | undefined {
  const ci = checkIn.trim()
  const co = checkOut.trim()
  if (!ci && !co) return undefined
  return `check in note :\n${ci || '—'}\n\ncheck out note :\n${co || '—'}`
}

export function CompleteRentalDialog({ open, rentalId, downPayment, checkInNote, onClose, onCompleted }: Props) {
  const [gross, setGross] = useState('')
  const [checkOutNote, setCheckOutNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    if (!rentalId) return
    const grossInput = Number(gross.replace(/\D/g, ''))
    if (!Number.isFinite(grossInput) || grossInput < 0) {
      setError('Enter a valid gross income amount (IDR).')
      return
    }
    const totalGrossIncome = downPayment + grossInput
    if (totalGrossIncome <= 0) {
      setError('Total gross income (down payment + completion amount) must be greater than 0.')
      return
    }
    setBusy(true)
    setError(null)
    const combinedNote = buildCombinedNote(checkInNote ?? '', checkOutNote)
    const { error: doneError } = await completeRentalWithIncome(rentalId, totalGrossIncome, combinedNote)
    setBusy(false)
    if (doneError) {
      setError(doneError.message)
      return
    }
    setGross('')
    setCheckOutNote('')
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

        {checkInNote ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Check-in note
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {checkInNote}
              </Typography>
            </Paper>
          </Box>
        ) : null}

        <TextField
          size="small"
          label="Gross income at completion (IDR)"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          helperText={
            downPayment > 0
              ? `Down payment ${formatIdr(downPayment)} is automatically added.`
              : undefined
          }
        />
        <TextField
          size="small"
          label="Check-out note (optional)"
          value={checkOutNote}
          onChange={(e) => setCheckOutNote(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          placeholder="e.g. Fuel: ½ tank returned. Charged extra for fuel difference."
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
