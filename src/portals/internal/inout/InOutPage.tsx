import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
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
import { completeRentalWithIncome } from '../../../lib/feeEngine'
import { formatIdr } from '../../../lib/formatIdr'
import { insertDownPaymentIncomeTransaction } from '../../../lib/rentalDownPaymentTxn'
import { calcCost, type CostBreakdown } from '../../../lib/rentalCost'
import { calcDriverFeeVariantA } from '../../../lib/driverFee'
import { fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { buildWhatsAppMeUrlWithMessage } from '../../../lib/whatsappLink'
import {
  generateRentalInvoicePdf,
  calcInvoiceTotals,
} from '../../internal/rentals/rentalInvoicePdf'
import { buildInvoiceWhatsAppMessage } from '../../internal/rentals/rentalInvoiceWhatsapp'
import type { RentalWithCar } from '../../../types/rental'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { AddDpDialog } from './AddDpDialog'
import { CancelPasswordDialog } from './CancelPasswordDialog'
import { TarifInfoDialog } from './TarifInfoDialog'

// ─── RENTAL COST HELPERS ─────────────────────────────────────────────────────

function calcElapsedHours(startDate: string, startTime: string | null, until?: Dayjs): number {
  const timeStr = startTime ?? '00:00'
  const start = dayjs(`${startDate}T${timeStr}`)
  const end = until ?? dayjs()
  return end.diff(start, 'minute') / 60
}

function formatElapsed(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  const days = Math.floor(h / 24)
  const remH = h % 24
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (remH > 0 || days === 0) parts.push(`${remH}h`)
  if (m > 0) parts.push(`${m}m`)
  return parts.join(' ')
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


function buildCombinedNote(checkIn: string, checkOut: string): string | undefined {
  const ci = checkIn.trim()
  const co = checkOut.trim()
  if (!ci && !co) return undefined
  const parts: string[] = []
  parts.push(`check in note :\n${ci || '—'}`)
  parts.push(`check out note :\n${co || '—'}`)
  return parts.join('\n\n')
}

// ─── CHECK IN ────────────────────────────────────────────────────────────────

function availabilityEndYmd(start: Dayjs, durationDaysInput: string): string {
  const raw = durationDaysInput.trim()
  const n = raw === '' ? null : Number(raw.replace(/\D/g, ''))
  if (n != null && Number.isFinite(n) && n >= 1) {
    return start.add(Math.floor(n) - 1, 'day').format('YYYY-MM-DD')
  }
  return start.format('YYYY-MM-DD')
}

function CheckInPanel({ onSaved }: { onSaved: () => void }) {
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
    setSuccess(`${carName} disewakan ke ${renterName.trim()}. Sewa dimulai.`)
    reset()
    onSaved()
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
          label="DP (IDR)"
          value={downPayment}
          onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          fullWidth
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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
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

// ─── CHECK OUT ───────────────────────────────────────────────────────────────

type RentalWithCarRate = RentalWithCar & {
  v2_cars: { name: string; plate: string; daily_rate: number | null; mileage: number | null } | null
}

function CheckOutPanel({ refreshTick, onCompleted }: { refreshTick: number; onCompleted: () => void }) {
  const [activeRentals, setActiveRentals] = useState<RentalWithCarRate[]>([])
  const [loadingRentals, setLoadingRentals] = useState(true)
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [selectedId, setSelectedId] = useState('')
  const [gross, setGross] = useState('')
  const [driverFeeInput, setDriverFeeInput] = useState('')
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs())
  const [endTime, setEndTime] = useState<Dayjs | null>(dayjs())
  const [checkOutNote, setCheckOutNote] = useState('')
  const [checkoutMileage, setCheckoutMileage] = useState('')
  const [blacklist, setBlacklist] = useState(false)
  const [blacklistNote, setBlacklistNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [cancelPasswordOpen, setCancelPasswordOpen] = useState(false)
  const [addDpModalOpen, setAddDpModalOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [tarifInfoOpen, setTarifInfoOpen] = useState(false)
  const [dailyDriverRate, setDailyDriverRate] = useState(0)

  useEffect(() => {
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'overtime_hourly_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setOvertimeRate(Number(data.value))
      })
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'daily_driver_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value != null) {
          const n = Number(data.value)
          if (Number.isFinite(n) && n > 0) setDailyDriverRate(n)
        }
      })
    void fetchCompanyDisplayName(supabase).then(setCompanyName)
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'bank_acc')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setBankAccount(String(data.value))
      })
  }, [])

  const loadActive = useCallback(async () => {
    setLoadingRentals(true)
    const { data, error: qError } = await supabase
      .from('v2_rentals')
      .select('*, v2_cars(name, plate, daily_rate, mileage)')
      .eq('status', 'active')
      .order('start_date', { ascending: false })
    setLoadingRentals(false)
    if (!qError) setActiveRentals((data ?? []) as RentalWithCarRate[])
  }, [])

  useEffect(() => {
    void loadActive()
  }, [loadActive, refreshTick])

  const selected = activeRentals.find((r) => r.id === selectedId) ?? null

  const downPayment = Number(selected?.down_payment ?? 0)
  const checkInNote = selected?.manual_note ?? ''
  const completionMoment = useMemo<Dayjs | null>(() => {
    if (!endDate || !endTime) return null
    return dayjs(`${endDate.format('YYYY-MM-DD')}T${endTime.format('HH:mm')}`)
  }, [endDate, endTime])

  const costBreakdown = useMemo<CostBreakdown | null>(() => {
    if (!selected?.start_date) return null
    const dailyRate = selected.v2_cars?.daily_rate
    if (!dailyRate) return null
    if (!completionMoment) return null
    const elapsed = calcElapsedHours(selected.start_date, selected.start_time ?? null, completionMoment)
    if (elapsed < 0) return null
    return calcCost(elapsed, dailyRate, overtimeRate)
  }, [selected, overtimeRate, completionMoment])

  const checkoutDriverFee = useMemo(() => {
    if (!selected?.start_date || !completionMoment) return 0
    const elapsed = calcElapsedHours(selected.start_date, selected.start_time ?? null, completionMoment)
    if (elapsed < 0) return 0
    return calcDriverFeeVariantA(elapsed, dailyDriverRate, !!selected.include_driver)
  }, [selected, completionMoment, dailyDriverRate])

  const combinedRefTotal = useMemo(() => {
    const vehiclePart = costBreakdown?.total
    const hasVehicle = vehiclePart != null
    if (!hasVehicle && checkoutDriverFee <= 0) return null
    return (vehiclePart ?? 0) + checkoutDriverFee
  }, [costBreakdown, checkoutDriverFee])

  const refElapsedHours = useMemo(() => {
    if (!selected?.start_date || !completionMoment) return null
    const e = calcElapsedHours(selected.start_date, selected.start_time ?? null, completionMoment)
    return e >= 0 ? e : null
  }, [selected, completionMoment])

  async function handleComplete() {
    if (!selectedId || !selected) return
    const grossInput = Number(gross.replace(/\D/g, ''))
    if (!Number.isFinite(grossInput) || grossInput < 0) {
      setError('Masukkan jumlah pendapatan kotor yang valid (IDR).')
      return
    }
    const driverFeeParsed = selected.include_driver
      ? Number(driverFeeInput.replace(/\D/g, '') || 0)
      : 0
    if (!Number.isFinite(driverFeeParsed) || driverFeeParsed < 0) {
      setError('Biaya sopir harus berupa angka yang valid.')
      return
    }
    const totalGrossIncome = downPayment + grossInput + driverFeeParsed
    if (totalGrossIncome <= 0) {
      setError('Total pendapatan kotor (DP + sisa pembayaran + biaya sopir) harus lebih dari 0.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)

    const completionAt =
      endDate && endTime
        ? {
            endDate: endDate.format('YYYY-MM-DD'),
            endTime: endTime.format('HH:mm'),
          }
        : null

    if (!completionAt) {
      setBusy(false)
      setError('Tanggal dan jam selesai wajib diisi.')
      return
    }

    const combinedNote = buildCombinedNote(checkInNote, checkOutNote)

    let mileageKm: number | null = null
    const mileageTrim = checkoutMileage.trim()
    if (mileageTrim !== '') {
      const n = Number(mileageTrim.replace(/\D/g, ''))
      if (!Number.isFinite(n) || n < 0) {
        setBusy(false)
        setError('Masukkan kilometer yang valid (bilangan bulat ≥ 0).')
        return
      }
      mileageKm = Math.round(n)
    }

    const driverSnap =
      selected.include_driver && driverFeeParsed > 0 ? driverFeeParsed : null

    const { error: doneError } = await completeRentalWithIncome(selectedId, totalGrossIncome, combinedNote, completionAt, {
      ...(selected.car_id ? { carId: selected.car_id } : {}),
      ...(mileageKm != null ? { mileageKm } : {}),
      driverFeeSnapshot: driverSnap,
    })
    if (doneError) {
      setBusy(false)
      setError(doneError.message)
      return
    }

    if (blacklist && selected) {
      const phone = selected.renter_phone ?? null
      const blacklistNoteValue = blacklistNote.trim() || null
      if (phone) {
        const { data: existing } = await supabase
          .from('v2_renter_info')
          .select('id')
          .eq('phone', phone)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('v2_renter_info')
            .update({ status: 'blacklisted', notes: blacklistNoteValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('v2_renter_info').insert({
            name: selected.renter_name,
            phone,
            status: 'blacklisted',
            notes: blacklistNoteValue,
          })
        }
      } else {
        const { data: existing } = await supabase
          .from('v2_renter_info')
          .select('id')
          .eq('name', selected.renter_name)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('v2_renter_info')
            .update({ status: 'blacklisted', notes: blacklistNoteValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('v2_renter_info').insert({
            name: selected.renter_name,
            status: 'blacklisted',
            notes: blacklistNoteValue,
          })
        }
      }
    }

    setBusy(false)
    const label = selected?.renter_name ?? 'Rental'
    setSuccess(`${label} selesai. Total: ${formatIdr(totalGrossIncome)}.`)
    setSelectedId('')
    setGross('')
    setDriverFeeInput('')
    setEndDate(dayjs())
    setEndTime(dayjs())
    setCheckOutNote('')
    setCheckoutMileage('')
    setBlacklist(false)
    setBlacklistNote('')
    void loadActive()
    onCompleted()
  }

  function handleKirimTagihan() {
    if (!selected) return
    const totals = calcInvoiceTotals(selected, overtimeRate, dailyDriverRate)
    generateRentalInvoicePdf(selected, companyName, bankAccount, overtimeRate, dailyDriverRate)
    if (selected.renter_phone) {
      const msg = buildInvoiceWhatsAppMessage(selected, totals, bankAccount)
      const waUrl = buildWhatsAppMeUrlWithMessage(selected.renter_phone, msg)
      if (waUrl) window.open(waUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function handleAddDpSubmit(addAmount: number): Promise<string | null> {
    if (!selected?.car_id) return 'Sewa tidak ditemukan.'
    const prev = Number(selected.down_payment ?? 0)
    const next = prev + addAmount
    setSuccess(null)

    const { error: uErr } = await supabase
      .from('v2_rentals')
      .update({ down_payment: next })
      .eq('id', selected.id)
    if (uErr) return uErr.message

    const { error: dpErr } = await insertDownPaymentIncomeTransaction(
      supabase,
      selected.car_id,
      selected.id,
      addAmount,
    )
    if (dpErr) {
      await supabase.from('v2_rentals').update({ down_payment: prev }).eq('id', selected.id)
      return dpErr.message
    }

    setSuccess(`DP bertambah ${formatIdr(addAmount)}. Total DP sekarang: ${formatIdr(next)}.`)
    void loadActive()
    onCompleted()
    return null
  }

  async function handleCancelEarlyRent() {
    if (!selected) return
    setConfirmCancelOpen(false)
    setBusy(true)
    setError(null)
    setSuccess(null)
    const rentalId = selected.id
    const carId = selected.car_id

    const { error: orderErr } = await supabase.from('v2_orders').update({ rental_id: null }).eq('rental_id', rentalId)
    if (orderErr) {
      setBusy(false)
      setError(orderErr.message)
      return
    }

    const { error: delErr } = await supabase.from('v2_rentals').delete().eq('id', rentalId)
    if (delErr) {
      setBusy(false)
      setError(delErr.message)
      return
    }

    const { error: carErr } = await supabase.from('v2_cars').update({ status: 'available' }).eq('id', carId)
    setBusy(false)
    if (carErr) {
      setError(
        `${carErr.message} Sewa telah dihapus; periksa status kendaraan secara manual jika perlu.`,
      )
      void loadActive()
      onCompleted()
      return
    }

    const label = selected.renter_name ?? 'Penyewa'
    setSuccess(`Sewa dibatalkan. ${label} — data penyewa di info penyewa tidak diubah.`)
    setSelectedId('')
    setGross('')
    setDriverFeeInput('')
    setEndDate(dayjs())
    setEndTime(dayjs())
    setCheckOutNote('')
    setCheckoutMileage('')
    setBlacklist(false)
    setBlacklistNote('')
    void loadActive()
    onCompleted()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {success ? <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert> : null}

      <FormControl fullWidth size="small">
        <InputLabel id="co-rental">Sewa aktif</InputLabel>
        <Select
          labelId="co-rental"
          label="Sewa aktif"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setGross('')
            setDriverFeeInput('')
            setEndDate(dayjs())
            setEndTime(dayjs())
            setCheckOutNote('')
            setCheckoutMileage('')
            setBlacklist(false)
            setBlacklistNote('')
            setError(null)
          }}
          disabled={loadingRentals}
        >
          {activeRentals.length === 0 ? (
            <MenuItem disabled value="">
              <em>{loadingRentals ? 'Memuat…' : 'Tidak ada sewa aktif'}</em>
            </MenuItem>
          ) : null}
          {activeRentals.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.v2_cars ? `${r.v2_cars.name} (${r.v2_cars.plate})` : '—'} — {r.renter_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selected ? (
        <Button
          variant="outlined"
          size="small"
          onClick={() => setAddDpModalOpen(true)}
          disabled={loadingRentals || busy || addDpModalOpen}
          sx={{ alignSelf: 'flex-start' }}
        >
          Tambah DP (tanpa checkout)
        </Button>
      ) : null}

      {selected ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.75 }}
          >
            Catatan Check-in
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Mulai:{' '}
            <strong>
              {selected.start_date}
              {selected.start_time ? `, ${selected.start_time.slice(0, 5)}` : ''}
            </strong>
            {!selected.start_time ? (
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                (jam belum dicatat)
              </Typography>
            ) : null}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            DP: <strong>{formatIdr(downPayment)}</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5, whiteSpace: 'pre-wrap' }}>
            Catatan: {checkInNote.trim() ? checkInNote : '—'}
          </Typography>
          <Chip
            size="small"
            color={selected.include_driver ? 'secondary' : 'default'}
            variant={selected.include_driver ? 'outlined' : 'filled'}
            label={selected.include_driver ? 'Dengan Driver' : 'Lepas Kunci'}
          />
        </Paper>
      ) : null}

      <AddDpDialog
        open={addDpModalOpen}
        currentDownPayment={downPayment}
        onClose={() => setAddDpModalOpen(false)}
        onSubmit={handleAddDpSubmit}
      />

      {selected ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Referensi Tarif
            </Typography>
            <Tooltip title="Lihat aturan tarif">
              <IconButton
                size="small"
                aria-label="Aturan tarif"
                onClick={() => setTarifInfoOpen(true)}
                sx={{ p: 0.25, color: 'text.secondary' }}
              >
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Berlangsung:{' '}
            <strong>
              {costBreakdown
                ? formatElapsed(costBreakdown.elapsedHours)
                : refElapsedHours != null
                  ? formatElapsed(refElapsedHours)
                  : '—'}
            </strong>
          </Typography>
          {combinedRefTotal != null ? (
            <>
              {costBreakdown ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                  <Chip size="small" label={`${costBreakdown.fullDays}d × ${formatIdr(selected.v2_cars!.daily_rate!)} = ${formatIdr(costBreakdown.dailyCost)}`} />
                  {costBreakdown.overtimeHours > 0 ? (
                    <Chip size="small" color="warning" label={`${costBreakdown.overtimeHours}h OT × ${formatIdr(overtimeRate)} = ${formatIdr(costBreakdown.overtimeCost)}`} />
                  ) : null}
                </Box>
              ) : null}
              {checkoutDriverFee > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                  <Chip size="small" color="info" variant="outlined" label={`Sopir: ${formatIdr(checkoutDriverFee)}`} />
                </Box>
              ) : null}
              <Typography variant="body2" sx={{ mb: 0.25 }}>
                Total referensi: <strong>{formatIdr(combinedRefTotal)}</strong>
              </Typography>
              {downPayment > 0 ? (
                <Typography variant="body2">
                  Sisa tagihan: <strong>{formatIdr(Math.max(0, combinedRefTotal - downPayment))}</strong>
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">Hanya referensi — masukkan jumlah aktual di bawah.</Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {selected.v2_cars?.daily_rate == null && !selected.include_driver
                ? 'Tarif harian belum diatur untuk kendaraan ini.'
                : null}
              {selected.include_driver && dailyDriverRate <= 0 ? (
                <>Atur pengaturan aplikasi <strong>daily_driver_rate</strong> untuk hitung sopir.</>
              ) : null}
            </Typography>
          )}
          <Box sx={{ display: 'flex', mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={handleKirimTagihan}
            >
              Kirim Referensi Tarif
            </Button>
          </Box>
        </Paper>
      ) : null}

      <TextField
        size="small"
        label="Sisa pembayaran di checkout (IDR)"
        value={gross}
        onChange={(e) => setGross(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        fullWidth
        disabled={!selectedId}
        helperText={
          selected?.include_driver
            ? downPayment > 0
              ? `Hanya bagian kendaraan (sisa sewa mobil). Total kotor = DP + sisa ini + biaya sopir.`
              : `Hanya bagian kendaraan. Total kotor = sisa ini + biaya sopir (tanpa DP).`
            : downPayment > 0
              ? `DP ${formatIdr(downPayment)} sudah tercatat di transaksi. Total kotor = DP + isian ini.`
              : 'Jumlah yang diterima saat selesai (total sewa jika tanpa DP).'
        }
      />

      {selected?.include_driver ? (
        <TextField
          size="small"
          label="Driver fee (IDR)"
          value={driverFeeInput}
          onChange={(e) => setDriverFeeInput(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          fullWidth
          disabled={!selectedId}
          helperText={
            checkoutDriverFee > 0 && dailyDriverRate > 0
              ? `Acuan dari durasi & tarif sopir: ${formatIdr(checkoutDriverFee)}. Isi sesuai bayar ke sopir.`
              : 'Bagian sopir (terpisah dari sisa pembayaran kendaraan).'
          }
        />
      ) : null}

      <TextField
        size="small"
        label="Kilometer (odometer) saat ini"
        value={checkoutMileage}
        onChange={(e) => setCheckoutMileage(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        fullWidth
        disabled={!selectedId}
        helperText={
          selected?.v2_cars?.mileage != null
            ? `Terakhir tercatat: ${selected.v2_cars.mileage.toLocaleString('id-ID')} km. Opsional — isi untuk memperbarui.`
            : 'Opsional. Mencatat KM kendaraan saat check-out.'
        }
      />

      {selectedId && (gross || (selected?.include_driver && driverFeeInput)) ? (
        <Typography variant="body2" color="text.secondary">
          Total pendapatan kotor:{' '}
          <strong>
            {formatIdr(
              downPayment +
                Number(gross.replace(/\D/g, '') || 0) +
                (selected?.include_driver ? Number(driverFeeInput.replace(/\D/g, '') || 0) : 0),
            )}
          </strong>
        </Typography>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <DatePicker
          label="Tanggal selesai"
          value={endDate}
          onChange={(v) => setEndDate(v)}
          disabled={!selectedId}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />
        <TimePicker
          label="Jam selesai (24 jam)"
          value={endTime}
          onChange={(v) => setEndTime(v)}
          ampm={false}
          disabled={!selectedId}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />
      </Box>

      <TextField
        size="small"
        label="Catatan check-out (opsional)"
        value={checkOutNote}
        onChange={(e) => setCheckOutNote(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        disabled={!selectedId}
        placeholder="mis. Bensin: ½ tangki dikembalikan. Dikenakan biaya kekurangan bensin."
      />

      <FormControlLabel
        control={
          <Switch
            checked={blacklist}
            onChange={(_, v) => {
              setBlacklist(v)
              if (!v) setBlacklistNote('')
            }}
            size="small"
            color="error"
            disabled={!selectedId}
          />
        }
        label={<Typography variant="body2" color={blacklist ? 'error' : 'text.secondary'}>Blokir penyewa ini</Typography>}
      />

      {blacklist ? (
        <TextField
          size="small"
          label="Alasan pemblokiran"
          value={blacklistNote}
          onChange={(e) => setBlacklistNote(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          placeholder="Alasan pemblokiran…"
          color="error"
        />
      ) : null}

      {selected ? (
        <Alert severity="info" variant="outlined">
          Membatalkan sewa memerlukan kata sandi akun internal Anda, lalu konfirmasi. Data penyewa di Info Penyewa
          tetap tersimpan.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'flex-end',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1,
          mt: 1,
        }}
      >
        {selected ? (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setCancelPasswordOpen(true)}
            disabled={busy || addDpModalOpen || !selectedId}
            sx={{ mr: { sm: 'auto' } }}
          >
            Batalkan sewa
          </Button>
        ) : null}
        <Button
          variant="contained"
          color="success"
          onClick={() => void handleComplete()}
          disabled={busy || addDpModalOpen || !selectedId}
        >
          {busy ? 'Menyelesaikan…' : 'Selesaikan sewa'}
        </Button>
      </Box>

      <CancelPasswordDialog
        open={cancelPasswordOpen}
        onClose={() => setCancelPasswordOpen(false)}
        onVerified={() => {
          setCancelPasswordOpen(false)
          setConfirmCancelOpen(true)
        }}
      />

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Batalkan sewa?"
        description="Sewa aktif akan dihapus dan kendaraan dikembalikan ke status Tersedia. Riwayat renter di Info Penyewa tidak diubah. Lanjutkan?"
        confirmLabel="Batalkan sewa"
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => void handleCancelEarlyRent()}
      />

      <TarifInfoDialog open={tarifInfoOpen} onClose={() => setTarifInfoOpen(false)} />
    </Box>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export function InOutPage() {
  const [refreshTick, setRefreshTick] = useState(0)
  const [tab, setTab] = useState(0)
  const bump = () => setRefreshTick((n) => n + 1)

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 3 }}>
        Masuk / Keluar
      </Typography>

      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, v: number) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          <Tab label="Check In — Mulai Sewa" />
          <Tab label="Check Out — Selesaikan Sewa" />
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 ? <CheckInPanel onSaved={bump} /> : null}
          {tab === 1 ? <CheckOutPanel refreshTick={refreshTick} onCompleted={bump} /> : null}
        </Box>
      </Paper>
    </Box>
  )
}
