import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { useDialogFullScreen } from '../../../hooks/useDialogFullScreen'
import { supabase } from '../../../lib/supabase'
import type { TransactionCategory, TransactionType } from '../../../types/transaction'

const CATEGORIES: TransactionCategory[] = [
  'rental_income',
  'gps_topup',
  'maintenance',
  'partner_fee',
  'owner_withdrawal',
  'other',
]

type Props = {
  open: boolean
  carId: string
  onClose: () => void
  onSaved: () => void
}

export function ManualTransactionDialog({ open, carId, onClose, onSaved }: Props) {
  const fullScreen = useDialogFullScreen()
  const [type, setType] = useState<TransactionType>('income')
  const [category, setCategory] = useState<TransactionCategory>('other')
  const [amount, setAmount] = useState('')
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [manualNote, setManualNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const n = Number(amount.replace(/\D/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount (IDR).')
      return
    }
    setSaving(true)
    setError(null)
    const iso = new Date(recordedAt).toISOString()
    const { error: iError } = await supabase.from('v2_transactions').insert({
      car_id: carId,
      rental_id: null,
      type,
      category,
      amount: n,
      auto_fee: false,
      manual_note: manualNote.trim() || null,
      recorded_at: iso,
    })
    setSaving(false)
    if (iError) {
      setError(iError.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle>Manual transaction</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <FormControl fullWidth>
          <InputLabel id="t-label">Type</InputLabel>
          <Select
            labelId="t-label"
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
          >
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="c-label">Category</InputLabel>
          <Select
            labelId="c-label"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TransactionCategory)}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="Amount (IDR)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField
          label="Recorded at"
          type="datetime-local"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField label="Note" value={manualNote} onChange={(e) => setManualNote(e.target.value)} multiline minRows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
