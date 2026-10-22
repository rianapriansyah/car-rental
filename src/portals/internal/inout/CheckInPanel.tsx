import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { RenterNamePhoneFields } from '../../../components/RenterNamePhoneFields'
import { checkCarAvailability, getCheckInOrderWarnings } from '../../../lib/carAvailability'
import { fetchOrderWarningDays } from '../../../lib/orderAppSettings'
import { formatAvailabilityConflictMessage } from '../../../lib/formatScheduleConflict'
import { ensureRenterInInfo, isRenterBlacklisted } from '../../../lib/renterInfoHelpers'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import { insertDownPaymentIncomeTransaction } from '../../../lib/rentalDownPaymentTxn'

/** Formats a raw digit string as Indonesian thousands-separated number, e.g. "300000" → "300.000" */
function fmtNumInput(raw: string): string {
  if (!raw) return ''
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

type CarOption = {
  id: string
  name: string
  plate: string
  /** Relative time since last completed rental ended, e.g. "3 hari yang lalu"; null if none. */
  lastCompletedRelative: string | null
}

/** Indonesian relative label from rental completion (end_date / end_time). */
function formatLastCompletedRelativeId(endDate: string, endTime: string | null): string {
  const t = endTime?.trim() || '23:59'
  const end = dayjs(`${endDate}T${t}`)
  const days = dayjs().startOf('day').diff(end.startOf('day'), 'day')
  if (days <= 0) return 'hari ini'
  if (days === 1) return 'kemarin'
  return `${days} hari yang lalu`
}

function CarSelectMenuRow({ c }: { c: CarOption }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: 0.75,
        rowGap: 0.25,
      }}
    >
      <span>
        {c.name} — {c.plate}
      </span>
      {c.lastCompletedRelative ? (
        <Typography component="span" variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          ({c.lastCompletedRelative})
        </Typography>
      ) : null}
    </Box>
  )
}

function availabilityEndYmd(start: Dayjs, durationDaysInput: string): string {
  const raw = durationDaysInput.trim()
  const n = raw === '' ? null : Number(raw.replace(/\D/g, ''))
  if (n != null && Number.isFinite(n) && n >= 1) {
    return start.add(Math.floor(n) - 1, 'day').format('YYYY-MM-DD')
  }
  return start.format('YYYY-MM-DD')
}

export function CheckInPanel({
  onSaved,
  onCancel,
}: {
  /** Called after the rental is created, with the Indonesian success message. */
  onSaved: (message: string) => void
  /** When provided, renders a close button in the action row (used when hosted in a dialog). */
  onCancel?: () => void
}) {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  const [renterName, setRenterName] = useState('')
  const [renterPhone, setRenterPhone] = useState('')
  const [renterBlacklistBlocked, setRenterBlacklistBlocked] = useState(false)
  const [scheduleConflict, setScheduleConflict] = useState<string | null>(null)
  const [orderCheckInBlock, setOrderCheckInBlock] = useState<string | null>(null)
  const [orderCheckInWarning, setOrderCheckInWarning] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs())
  const [durationDays, setDurationDays] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [includeDriver, setIncludeDriver] = useState(false)
  const [note, setNote] = useState('')
  const [dailyDriverRatePreview, setDailyDriverRatePreview] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name, plate')
      .eq('status', 'available')
      .is('deleted_at', null)
      .order('name')
    if (qError) return
    const list = data ?? []
    const ids = list.map((c) => c.id)
    const latestEndByCar = new Map<string, { end_date: string; end_time: string | null }>()
    if (ids.length > 0) {
      const { data: rentalRows } = await supabase
        .from('v2_rentals')
        .select('car_id, end_date, end_time')
        .eq('status', 'completed')
        .in('car_id', ids)
      for (const r of rentalRows ?? []) {
        if (!r.end_date) continue
        const cur = latestEndByCar.get(r.car_id)
        const rEnd = dayjs(`${r.end_date}T${r.end_time?.trim() || '23:59'}`)
        if (!cur) {
          latestEndByCar.set(r.car_id, { end_date: r.end_date, end_time: r.end_time })
          continue
        }
        const cEnd = dayjs(`${cur.end_date}T${cur.end_time?.trim() || '23:59'}`)
        if (rEnd.isAfter(cEnd)) {
          latestEndByCar.set(r.car_id, { end_date: r.end_date, end_time: r.end_time })
        }
      }
    }
    const merged: CarOption[] = list.map((c) => {
      const end = latestEndByCar.get(c.id)
      return {
        ...c,
        lastCompletedRelative: end
          ? formatLastCompletedRelativeId(end.end_date, end.end_time)
          : null,
      }
    })
    setCars(merged)
  }, [])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'daily_driver_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || data?.value == null) return
        const n = Number(data.value)
        if (Number.isFinite(n) && n > 0) setDailyDriverRatePreview(n)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!carId || !startDate) {
      setScheduleConflict(null)
      setOrderCheckInBlock(null)
      setOrderCheckInWarning(null)
      return
    }
    const startStr = startDate.format('YYYY-MM-DD')
    const endStr = availabilityEndYmd(startDate, durationDays)
    let cancelled = false
    void (async () => {
      const { rows, error: avErr } = await checkCarAvailability(carId, startStr, endStr)
      if (cancelled) return
      if (avErr) {
        setScheduleConflict(avErr.message)
        setOrderCheckInBlock(null)
        setOrderCheckInWarning(null)
        return
      }
      if (rows.length > 0) {
        setScheduleConflict(formatAvailabilityConflictMessage(rows))
        setOrderCheckInBlock(null)
        setOrderCheckInWarning(null)
        return
      }
      setScheduleConflict(null)
      try {
        const wd = await fetchOrderWarningDays()
        const { blockMessage, warningMessage } = await getCheckInOrderWarnings(carId, startStr, wd)
        if (cancelled) return
        setOrderCheckInBlock(blockMessage)
        setOrderCheckInWarning(blockMessage ? null : warningMessage)
      } catch {
        if (!cancelled) {
          setOrderCheckInBlock(null)
          setOrderCheckInWarning(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [carId, startDate, durationDays])

  function reset() {
    setCarId('')
    setRenterName('')
    setRenterPhone('')
    setRenterBlacklistBlocked(false)
    setScheduleConflict(null)
    setOrderCheckInBlock(null)
    setOrderCheckInWarning(null)
    setStartDate(null)
    setStartTime(dayjs())
    setDurationDays('')
    setDownPayment('')
    setIsManual(false)
    setIncludeDriver(false)
    setNote('')
    setError(null)
    void loadCars()
  }

  async function handleSave() {
    if (!carId || !renterName.trim() || !startDate) {
      setError('Kendaraan, nama penyewa, dan tanggal mulai wajib diisi.')
      return
    }
    if (renterBlacklistBlocked) {
      setError('Penyewa ini diblokir. Sewa tidak dapat dimulai.')
      return
    }
    if (scheduleConflict) {
      setError('Perbaiki bentrok jadwal sebelum menyimpan.')
      return
    }
    if (orderCheckInBlock) {
      setError(orderCheckInBlock)
      return
    }
    const downPaymentValue = Number(downPayment.replace(/\D/g, '') || 0)
    if (!Number.isFinite(downPaymentValue) || downPaymentValue < 0) {
      setError('DP harus berupa angka yang valid.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)

    const startStr = startDate.format('YYYY-MM-DD')
    const availabilityEnd = availabilityEndYmd(startDate, durationDays)

    const blocked = await isRenterBlacklisted(renterName, renterPhone.trim() || null)
    if (blocked) {
      setSaving(false)
      setError('Penyewa ini diblokir. Sewa tidak dapat dimulai.')
      return
    }

    const { rows: conflicts, error: avError } = await checkCarAvailability(carId, startStr, availabilityEnd)
    if (avError) {
      setSaving(false)
      setError(avError.message)
      return
    }
    if (conflicts.length > 0) {
      setSaving(false)
      setError(formatAvailabilityConflictMessage(conflicts))
      return
    }

    const { error: renterErr } = await ensureRenterInInfo(renterName, renterPhone.trim() || null)
    if (renterErr) {
      setSaving(false)
      setError(renterErr.message)
      return
    }

    const { rows: conflictsAgain, error: avError2 } = await checkCarAvailability(
      carId,
      startStr,
      availabilityEnd,
    )
    if (avError2) {
      setSaving(false)
      setError(avError2.message)
      return
    }
    if (conflictsAgain.length > 0) {
      setSaving(false)
      setError(formatAvailabilityConflictMessage(conflictsAgain))
      return
    }

    try {
      const wd = await fetchOrderWarningDays()
      const { blockMessage } = await getCheckInOrderWarnings(carId, startStr, wd)
      if (blockMessage) {
        setSaving(false)
        setError(blockMessage)
        return
      }
    } catch (e) {
      setSaving(false)
      setError(e instanceof Error ? e.message : 'Gagal memverifikasi pesanan.')
      return
    }

    const durationParsed = durationDays.trim() === '' ? null : Number(durationDays.replace(/\D/g, ''))
    const duration =
      durationParsed !== null && Number.isFinite(durationParsed) ? Math.round(durationParsed) : null

    const phoneTrimmed = renterPhone.trim() || null

    const { data: rental, error: rError } = await supabase
      .from('v2_rentals')
      .insert({
        car_id: carId,
        renter_name: renterName.trim(),
        renter_phone: phoneTrimmed,
        start_date: startStr,
        start_time: startTime ? startTime.format('HH:mm') : null,
        duration_days: duration,
        down_payment: downPaymentValue,
        status: 'active',
        is_manual: isManual,
        manual_note: note.trim() || null,
        include_driver: includeDriver,
      })
      .select('id')
      .single()

    if (rError || !rental) {
      setSaving(false)
      setError(rError?.message ?? 'Could not create rental.')
      return
    }

    const { error: cError } = await supabase.from('v2_cars').update({ status: 'rented' }).eq('id', carId)
    if (cError) {
      await supabase.from('v2_rentals').delete().eq('id', rental.id)
      setSaving(false)
      setError(cError.message)
      return
    }

    if (downPaymentValue > 0) {
      const { error: dpError } = await insertDownPaymentIncomeTransaction(
        supabase,
        carId,
        rental.id,
        downPaymentValue,
      )
      if (dpError) {
        await supabase.from('v2_rentals').delete().eq('id', rental.id)
        await supabase.from('v2_cars').update({ status: 'available' }).eq('id', carId)
        setSaving(false)
        setError(dpError.message)
        return
      }
    }

    setSaving(false)
    const carName = cars.find((c) => c.id === carId)?.name ?? 'Car'
    const message = `${carName} disewakan ke ${renterName.trim()}. Sewa dimulai.`
    setSuccess(message)
    reset()
    onSaved(message)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {success ? <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert> : null}

      {scheduleConflict ? (
        <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
          {scheduleConflict}
        </Alert>
      ) : null}
      {orderCheckInBlock && !scheduleConflict ? (
        <Alert severity="error">{orderCheckInBlock}</Alert>
      ) : null}
      {orderCheckInWarning && !scheduleConflict && !orderCheckInBlock ? (
        <Alert severity="warning">{orderCheckInWarning}</Alert>
      ) : null}

      <FormControl fullWidth size="small">
        <InputLabel id="ci-car">Kendaraan (tersedia)</InputLabel>
        <Select
          labelId="ci-car"
          label="Kendaraan (tersedia)"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          renderValue={(id) => {
            const c = cars.find((x) => x.id === id)
            if (!c) return ''
            return <CarSelectMenuRow c={c} />
          }}
        >
          {cars.length === 0 ? (
            <MenuItem disabled value=""><em>Tidak ada kendaraan tersedia</em></MenuItem>
          ) : null}
          {cars.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              <CarSelectMenuRow c={c} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {renterBlacklistBlocked ? (
        <Alert severity="error">Penyewa ini berstatus diblokir.</Alert>
      ) : null}
      <RenterNamePhoneFields
        name={renterName}
        phone={renterPhone}
        onNameChange={setRenterName}
        onPhoneChange={setRenterPhone}
        disabled={saving}
        onBlacklistActiveChange={setRenterBlacklistBlocked}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <DatePicker
          label="Tanggal mulai"
          value={startDate}
          onChange={(v) => setStartDate(v)}
          slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
        />
        <TimePicker
          label="Jam mulai (24 jam)"
          value={startTime}
          onChange={(v) => setStartTime(v)}
          ampm={false}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField
          size="small"
          label="Durasi (hari, opsional)"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          fullWidth
        />
        <TextField
          size="small"
          label="DP"
          value={fmtNumInput(downPayment)}
          onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          fullWidth
          slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment> } }}
          helperText="Dicatat sebagai DP sewa di transaksi; saat selesai masukkan sisa pembayaran (bukan total)."
        />
      </Box>

      <FormControlLabel
        control={
          <Switch checked={includeDriver} onChange={(_, v) => setIncludeDriver(v)} size="small" />
        }
        label={
          dailyDriverRatePreview != null ? (
            <Typography component="span" variant="body2">
              Sertakan sopir (acuan ±{formatIdr(Math.round(dailyDriverRatePreview / 2))} / blok 12 jam)
            </Typography>
          ) : (
            <Typography component="span" variant="body2">
              Sertakan sopir
            </Typography>
          )
        }
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

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'flex-end',
          gap: 1,
          mt: 1,
        }}
      >
        {onCancel ? (
          <Button onClick={onCancel} disabled={saving} sx={{ mr: { sm: 'auto' } }}>
            Tutup
          </Button>
        ) : null}
        <Button variant="outlined" onClick={reset} disabled={saving}>Reset</Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || renterBlacklistBlocked || !!scheduleConflict || !!orderCheckInBlock}
        >
          {saving ? 'Memulai…' : 'Mulai sewa'}
        </Button>
      </Box>
    </Box>
  )
}
