import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { RenterNamePhoneFields } from '../../../components/RenterNamePhoneFields'
import { supabase } from '../../../lib/supabase'
import { checkCarAvailability, hasUpcomingConfirmedOrderWarning } from '../../../lib/carAvailability'
import { formatAvailabilityConflictMessage } from '../../../lib/formatScheduleConflict'
import { fetchOrderWarningDays } from '../../../lib/orderAppSettings'
import { ensureRenterInInfo, isRenterBlacklisted } from '../../../lib/renterInfoHelpers'

type CarOption = { id: string; name: string; plate: string }

type Props = {
  open: boolean
  onClose: () => void
  /** Called after a successful insert with the new order id. */
  onSaved: (orderId: string) => void
}

function inclusiveDurationDays(start: Dayjs, end: Dayjs): number {
  return Math.max(1, end.startOf('day').diff(start.startOf('day'), 'day') + 1)
}

export function OrderFormDialog({ open, onClose, onSaved }: Props) {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  const [renterName, setRenterName] = useState('')
  const [renterPhone, setRenterPhone] = useState('')
  const [blacklistBlocked, setBlacklistBlocked] = useState(false)
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState<Dayjs | null>(null)
  const [estimatedIncome, setEstimatedIncome] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPaid, setDepositPaid] = useState(false)
  const [notes, setNotes] = useState('')
  const [hardConflict, setHardConflict] = useState<string | null>(null)
  const [softWarning, setSoftWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return null
    if (endDate.isBefore(startDate, 'day')) return null
    return inclusiveDurationDays(startDate, endDate)
  }, [startDate, endDate])

  useEffect(() => {
    if (!open) return
    setError(null)
    setCarId('')
    setRenterName('')
    setRenterPhone('')
    setBlacklistBlocked(false)
    setStartDate(null)
    setStartTime('')
    setEndDate(null)
    setEstimatedIncome('')
    setDepositAmount('')
    setDepositPaid(false)
    setNotes('')
    setHardConflict(null)
    setSoftWarning(null)
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

  const runAvailabilityChecks = useCallback(async () => {
    setHardConflict(null)
    setSoftWarning(null)
    if (!carId || !startDate || !endDate) return
    if (endDate.isBefore(startDate, 'day')) {
      setHardConflict('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    const startStr = startDate.format('YYYY-MM-DD')
    const endStr = endDate.format('YYYY-MM-DD')
    const { rows, error: avErr } = await checkCarAvailability(carId, startStr, endStr)
    if (avErr) {
      setHardConflict(avErr.message)
      return
    }
    if (rows.length > 0) {
      setHardConflict(formatAvailabilityConflictMessage(rows))
      return
    }
    try {
      const wd = await fetchOrderWarningDays()
      const warn = await hasUpcomingConfirmedOrderWarning(carId, wd)
      if (warn) {
        setSoftWarning(
          `Ada pesanan terkonfirmasi lain untuk kendaraan ini yang mulai dalam ${wd} hari ke depan. Anda tetap dapat melanjutkan jika jadwal tidak bentrok.`,
        )
      }
    } catch {
      setSoftWarning(null)
    }
  }, [carId, startDate, endDate])

  useEffect(() => {
    if (!open) return
    void runAvailabilityChecks()
  }, [open, runAvailabilityChecks])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  async function submit() {
    setError(null)
    if (!carId || !renterName.trim() || !startDate || !startTime || !endDate) {
      setError('Kendaraan, nama penyewa, tanggal mulai, jam mulai, dan tanggal selesai wajib diisi.')
      return
    }
    if (endDate.isBefore(startDate, 'day')) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    if (blacklistBlocked) {
      setError('Penyewa ini diblokir. Pesanan tidak dapat dibuat.')
      return
    }
    const blocked = await isRenterBlacklisted(renterName, renterPhone.trim() || null)
    if (blocked) {
      setError('Penyewa ini diblokir. Pesanan tidak dapat dibuat.')
      return
    }
    if (hardConflict) {
      setError('Perbaiki bentrok jadwal sebelum menyimpan.')
      return
    }
    const startStr = startDate.format('YYYY-MM-DD')
    const endStr = endDate.format('YYYY-MM-DD')
    const { rows: again, error: avErr } = await checkCarAvailability(carId, startStr, endStr)
    if (avErr) {
      setError(avErr.message)
      return
    }
    if (again.length > 0) {
      setError(formatAvailabilityConflictMessage(again))
      return
    }

    const dur = inclusiveDurationDays(startDate, endDate)
    const est = estimatedIncome.replace(/\D/g, '')
    const estNum = est === '' ? null : Number(est)
    const dep = depositAmount.replace(/\D/g, '')
    const depNum = dep === '' ? null : Number(dep)
    if (estNum !== null && (!Number.isFinite(estNum) || estNum < 0)) {
      setError('Perkiraan pendapatan tidak valid.')
      return
    }
    if (depNum !== null && (!Number.isFinite(depNum) || depNum < 0)) {
      setError('Jumlah deposit tidak valid.')
      return
    }

    setSaving(true)
    const { error: renterErr } = await ensureRenterInInfo(renterName, renterPhone.trim() || null)
    if (renterErr) {
      setSaving(false)
      setError(renterErr.message)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: inserted, error: insErr } = await supabase
      .from('v2_orders')
      .insert({
        car_id: carId,
        renter_name: renterName.trim(),
        renter_phone: renterPhone.trim() || null,
        status: 'confirmed',
        start_date: startStr,
        start_time: startTime,
        end_date: endStr,
        duration_days: dur,
        estimated_income: estNum,
        deposit_amount: depNum,
        deposit_paid: depositPaid,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    setSaving(false)
    if (insErr || !inserted) {
      setError(insErr?.message ?? 'Gagal menyimpan pesanan.')
      return
    }
    onSaved(inserted.id)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle>Tambah pesanan</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {blacklistBlocked ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Penyewa ini berstatus diblokir. Konfirmasi pesanan dinonaktifkan.
          </Alert>
        ) : null}
        {hardConflict ? (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            {hardConflict}
          </Alert>
        ) : null}
        {softWarning && !hardConflict ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {softWarning}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="order-car-label">Kendaraan (tersedia)</InputLabel>
            <Select
              labelId="order-car-label"
              label="Kendaraan (tersedia)"
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              disabled={saving}
            >
              {cars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} — {c.plate}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <RenterNamePhoneFields
            name={renterName}
            phone={renterPhone}
            onNameChange={setRenterName}
            onPhoneChange={setRenterPhone}
            disabled={saving}
            onBlacklistActiveChange={setBlacklistBlocked}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            <DatePicker
              label="Tanggal mulai"
              value={startDate}
              onChange={(v) => setStartDate(v)}
              disabled={saving}
              slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
            />
            <DatePicker
              label="Tanggal selesai"
              value={endDate}
              onChange={(v) => setEndDate(v)}
              disabled={saving}
              slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
            />
            <TextField
              size="small"
              label="Jam mulai"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              fullWidth
              disabled={saving}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
            />
          </Box>
          <TextField
            size="small"
            label="Durasi (hari)"
            value={durationDays != null ? String(durationDays) : '—'}
            fullWidth
            disabled
            helperText="Dihitung dari tanggal mulai dan selesai."
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <TextField
              size="small"
              label="Perkiraan pendapatan (IDR)"
              value={estimatedIncome}
              onChange={(e) => setEstimatedIncome(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              fullWidth
              disabled={saving}
            />
            <TextField
              size="small"
              label="Deposit (IDR)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              fullWidth
              disabled={saving}
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={depositPaid}
                onChange={(_, v) => setDepositPaid(v)}
                disabled={saving}
                size="small"
              />
            }
            label="Deposit sudah dibayar"
          />

          <TextField
            size="small"
            label="Catatan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            disabled={saving}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Batal
        </Button>
        <Button
          variant="contained"
          disabled={saving || blacklistBlocked || !!hardConflict}
          onClick={() => void submit()}
        >
          {saving ? 'Menyimpan…' : 'Konfirmasi pesanan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
