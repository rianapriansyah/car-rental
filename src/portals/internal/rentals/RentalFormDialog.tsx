import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import type { Dayjs } from 'dayjs'
import { supabase } from '../../../lib/supabase'

type CarOption = { id: string; name: string; plate: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function RentalFormDialog({ open, onClose, onSaved }: Props) {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  const [renterName, setRenterName] = useState('')
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)
  const [durationDays, setDurationDays] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setCarId('')
    setRenterName('')
    setStartDate(null)
    setEndDate(null)
    setDurationDays('')
    setDownPayment('')
    setIsManual(false)
    setNote('')
    void supabase
      .from('v2_cars')
      .select('id, name, plate')
      .eq('status', 'available')
      .is('deleted_at', null)
      .order('name')
      .then(({ data, error: qError }) => {
        if (qError) {
          setError(qError.message)
          return
        }
        setCars(data ?? [])
      })
  }, [open])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  async function save() {
    if (!carId || !renterName.trim() || !startDate) {
      setError('Car, renter name, and start date are required.')
      return
    }
    setSaving(true)
    setError(null)

    const startStr = startDate.format('YYYY-MM-DD')
    const endStr = endDate ? endDate.format('YYYY-MM-DD') : null

    const durationParsed = durationDays.trim() === '' ? null : Number(durationDays)
    const duration =
      durationParsed !== null && Number.isFinite(durationParsed) ? Math.round(durationParsed) : null
    const downPaymentValue = Number(downPayment.replace(/\D/g, '') || 0)
    if (!Number.isFinite(downPaymentValue) || downPaymentValue < 0) {
      setSaving(false)
      setError('Down payment must be a valid non-negative amount.')
      return
    }

    const { data: rental, error: rError } = await supabase
      .from('v2_rentals')
      .insert({
        car_id: carId,
        renter_name: renterName.trim(),
        start_date: startStr,
        end_date: endStr,
        duration_days: duration,
        down_payment: downPaymentValue,
        status: 'active',
        is_manual: isManual,
        manual_note: note.trim() || null,
      })
      .select('id')
      .single()

    if (rError || !rental) {
      setSaving(false)
      setError(rError?.message ?? 'Could not create rental')
      return
    }

    const { error: cError } = await supabase.from('v2_cars').update({ status: 'rented' }).eq('id', carId)

    if (cError) {
      await supabase.from('v2_rentals').delete().eq('id', rental.id)
      setSaving(false)
      setError(cError.message)
      return
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Start rental</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="car-label">Car (available)</InputLabel>
            <Select
              labelId="car-label"
              label="Car (available)"
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
            >
              {cars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} — {c.plate}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Renter name"
            value={renterName}
            onChange={(e) => setRenterName(e.target.value)}
            required
            fullWidth
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <DatePicker
              label="Start date"
              value={startDate}
              onChange={(v) => setStartDate(v)}
              slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
            />
            <DatePicker
              label="End date (optional)"
              value={endDate}
              onChange={(v) => setEndDate(v)}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Box>
          <TextField
            size="small"
            label="Duration (days, optional)"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            type="number"
            fullWidth
          />
          <TextField
            size="small"
            label="Down payment (IDR)"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            fullWidth
            helperText="Optional. This is added to gross income when completing rental."
          />
          <TextField
            size="small"
            label="Note (e.g. fuel level, condition)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            placeholder="e.g. Fuel: ¾ tank. Minor scratch on rear bumper."
          />
          <FormControlLabel
            control={<Switch checked={isManual} onChange={(_, v) => setIsManual(v)} size="small" />}
            label="Manual entry"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Starting…' : 'Start rental'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
