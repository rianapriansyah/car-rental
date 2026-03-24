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
      setError('Kendaraan, nama penyewa, dan tanggal mulai wajib diisi.')
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
      setError('DP harus berupa angka yang valid.')
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
      <DialogTitle>Mulai Sewa</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="car-label">Kendaraan (tersedia)</InputLabel>
            <Select
              labelId="car-label"
              label="Kendaraan (tersedia)"
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
            label="Nama penyewa"
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
              label="Tanggal mulai"
              value={startDate}
              onChange={(v) => setStartDate(v)}
              slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
            />
            <DatePicker
              label="Tanggal selesai (opsional)"
              value={endDate}
              onChange={(v) => setEndDate(v)}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Box>
          <TextField
            size="small"
            label="Durasi (hari, opsional)"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            type="number"
            fullWidth
          />
          <TextField
            size="small"
            label="DP (IDR)"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            fullWidth
            helperText="Opsional. Dijumlahkan dengan pendapatan kotor saat selesai."
          />
          <TextField
            size="small"
            label="Catatan (mis. level bahan bakar, kondisi)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            placeholder="mis. Bensin: ¾ tangki. Lecet kecil di bumper belakang."
          />
          <FormControlLabel
            control={<Switch checked={isManual} onChange={(_, v) => setIsManual(v)} size="small" />}
            label="Entri manual"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Batal
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Memulai…' : 'Mulai sewa'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
