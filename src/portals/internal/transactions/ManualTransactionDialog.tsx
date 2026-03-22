import { useState } from 'react'
import {
  Alert,
  Box,
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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
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
  const [type, setType] = useState<TransactionType>('income')
  const [category, setCategory] = useState<TransactionCategory>('other')
  const [amount, setAmount] = useState('')
  const [recordedAt, setRecordedAt] = useState<Dayjs>(() => dayjs())
  const [manualNote, setManualNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  async function save() {
    const n = Number(amount.replace(/\D/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount (IDR).')
      return
    }
    setSaving(true)
    setError(null)
    const iso = recordedAt.toISOString()
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Manual transaction</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 2,
          }}
        >
          <FormControl fullWidth size="small">
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
          <FormControl fullWidth size="small">
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
        </Box>
        <TextField
          size="small"
          label="Amount (IDR)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <DateTimePicker
          label="Recorded at"
          value={recordedAt}
          onChange={(v) => setRecordedAt(v ?? dayjs())}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />
        <TextField
          size="small"
          label="Note"
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          multiline
          minRows={4}
          fullWidth
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
