import { useEffect, useState } from 'react'
import {
  Alert,
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
import { useDialogFullScreen } from '../../../hooks/useDialogFullScreen'
import { supabase } from '../../../lib/supabase'

type CarOption = { id: string; name: string; plate: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function RentalFormDialog({ open, onClose, onSaved }: Props) {
  const fullScreen = useDialogFullScreen()
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  const [renterName, setRenterName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [manualNote, setManualNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setCarId('')
    setRenterName('')
    setStartDate('')
    setEndDate('')
    setDurationDays('')
    setIsManual(false)
    setManualNote('')
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

  async function save() {
    if (!carId || !renterName.trim() || !startDate) {
      setError('Car, renter name, and start date are required.')
      return
    }
    setSaving(true)
    setError(null)

    const durationParsed = durationDays.trim() === '' ? null : Number(durationDays)
    const duration =
      durationParsed !== null && Number.isFinite(durationParsed) ? Math.round(durationParsed) : null

    const { data: rental, error: rError } = await supabase
      .from('v2_rentals')
      .insert({
        car_id: carId,
        renter_name: renterName.trim(),
        start_date: startDate,
        end_date: endDate.trim() === '' ? null : endDate,
        duration_days: duration,
        status: 'active',
        is_manual: isManual,
        manual_note: isManual && manualNote.trim() ? manualNote.trim() : null,
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle>Start rental</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <FormControl fullWidth>
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
        <TextField label="Renter name" value={renterName} onChange={(e) => setRenterName(e.target.value)} required />
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          required
        />
        <TextField
          label="End date (optional)"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Duration (days, optional)"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          type="number"
        />
        <FormControlLabel
          control={<Switch checked={isManual} onChange={(_, v) => setIsManual(v)} />}
          label="Manual entry"
        />
        {isManual ? (
          <TextField
            label="Manual note"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            multiline
            minRows={2}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          Start rental
        </Button>
      </DialogActions>
    </Dialog>
  )
}
