import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { supabase } from '../../../lib/supabase'
import { completeRentalWithIncome } from '../../../lib/feeEngine'
import { formatIdr } from '../../../lib/formatIdr'
import type { RentalWithCar } from '../../../types/rental'

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

type CostBreakdown = {
  elapsedHours: number
  fullDays: number
  overtimeHours: number
  dailyCost: number
  overtimeCost: number
  total: number
}

function calcCost(elapsedHours: number, dailyRate: number, overtimeRate: number): CostBreakdown {
  // Minimum 1 day from the moment the rental is active.
  // Day 1 window = 25h (1h grace), day 2+ windows = 24h each.
  let fullDays = 1
  let overtimeHours = 0
  if (elapsedHours >= 25) {
    const afterFirst = elapsedHours - 25
    fullDays = 1 + Math.floor(afterFirst / 24)
    const remainder = afterFirst % 24
    overtimeHours = remainder > 0 ? Math.ceil(remainder) : 0
  }
  const dailyCost = fullDays * dailyRate
  const overtimeCost = overtimeHours * overtimeRate
  return { elapsedHours, fullDays, overtimeHours, dailyCost, overtimeCost, total: dailyCost + overtimeCost }
}

type CarOption = { id: string; name: string; plate: string }


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

function CheckInPanel({ onSaved }: { onSaved: () => void }) {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState('')
  const [renterName, setRenterName] = useState('')
  const [renterPhone, setRenterPhone] = useState('')
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs())
  const [durationDays, setDurationDays] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [note, setNote] = useState('')
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
    if (!qError) setCars(data ?? [])
  }, [])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  function reset() {
    setCarId('')
    setRenterName('')
    setRenterPhone('')
    setStartDate(null)
    setStartTime(dayjs())
    setDurationDays('')
    setDownPayment('')
    setIsManual(false)
    setNote('')
    setError(null)
    void loadCars()
  }

  async function handleSave() {
    if (!carId || !renterName.trim() || !startDate) {
      setError('Kendaraan, nama penyewa, dan tanggal mulai wajib diisi.')
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
    const durationParsed = durationDays.trim() === '' ? null : Number(durationDays)
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

    if (phoneTrimmed) {
      const { data: existing } = await supabase
        .from('v2_renter_info')
        .select('id, status')
        .eq('phone', phoneTrimmed)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('v2_renter_info')
          .update({ name: renterName.trim(), updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('v2_renter_info').insert({
          name: renterName.trim(),
          phone: phoneTrimmed,
          status: 'active',
        })
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

      <FormControl fullWidth size="small">
        <InputLabel id="ci-car">Kendaraan (tersedia)</InputLabel>
        <Select
          labelId="ci-car"
          label="Kendaraan (tersedia)"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
        >
          {cars.length === 0 ? (
            <MenuItem disabled value=""><em>Tidak ada kendaraan tersedia</em></MenuItem>
          ) : null}
          {cars.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name} — {c.plate}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField
          size="small"
          label="Nama penyewa"
          value={renterName}
          onChange={(e) => setRenterName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          size="small"
          label="Nomor HP (opsional)"
          value={renterPhone}
          onChange={(e) => setRenterPhone(e.target.value.replace(/\D/g, ''))}
          fullWidth
          inputMode="numeric"
          placeholder="mis. 081234567890"
        />
      </Box>

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
          helperText="Ditambahkan ke pendapatan kotor saat selesai."
        />
      </Box>

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
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Memulai…' : 'Mulai sewa'}
        </Button>
      </Box>
    </Box>
  )
}

// ─── CHECK OUT ───────────────────────────────────────────────────────────────

type RentalWithCarRate = RentalWithCar & { v2_cars: { name: string; plate: string; daily_rate: number | null } | null }

function CheckOutPanel({ refreshTick, onCompleted }: { refreshTick: number; onCompleted: () => void }) {
  const [activeRentals, setActiveRentals] = useState<RentalWithCarRate[]>([])
  const [loadingRentals, setLoadingRentals] = useState(true)
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [selectedId, setSelectedId] = useState('')
  const [gross, setGross] = useState('')
  const [useCurrentTime, setUseCurrentTime] = useState(true)
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs())
  const [endTime, setEndTime] = useState<Dayjs | null>(dayjs())
  const [checkOutNote, setCheckOutNote] = useState('')
  const [blacklist, setBlacklist] = useState(false)
  const [blacklistNote, setBlacklistNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    void supabase
      .from('v2_app_settings')
      .select('value')
      .eq('key', 'overtime_hourly_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setOvertimeRate(Number(data.value))
      })
  }, [])

  const loadActive = useCallback(async () => {
    setLoadingRentals(true)
    const { data, error: qError } = await supabase
      .from('v2_rentals')
      .select('*, v2_cars(name, plate, daily_rate)')
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
    if (useCurrentTime) return now
    if (!endDate || !endTime) return null
    return dayjs(`${endDate.format('YYYY-MM-DD')}T${endTime.format('HH:mm')}`)
  }, [useCurrentTime, now, endDate, endTime])

  const costBreakdown = useMemo<CostBreakdown | null>(() => {
    if (!selected?.start_date) return null
    const dailyRate = selected.v2_cars?.daily_rate
    if (!dailyRate) return null
    if (!completionMoment) return null
    const elapsed = calcElapsedHours(selected.start_date, selected.start_time ?? null, completionMoment)
    if (elapsed < 0) return null
    return calcCost(elapsed, dailyRate, overtimeRate)
  }, [selected, overtimeRate, completionMoment])

  async function handleComplete() {
    if (!selectedId) return
    const grossInput = Number(gross.replace(/\D/g, ''))
    if (!Number.isFinite(grossInput) || grossInput < 0) {
      setError('Masukkan jumlah pendapatan kotor yang valid (IDR).')
      return
    }
    const totalGrossIncome = downPayment + grossInput
    if (totalGrossIncome <= 0) {
      setError('Total pendapatan kotor (DP + jumlah saat selesai) harus lebih dari 0.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)

    const completionAt =
      useCurrentTime
        ? {
            endDate: dayjs().format('YYYY-MM-DD'),
            endTime: dayjs().format('HH:mm'),
          }
        : endDate && endTime
          ? {
              endDate: endDate.format('YYYY-MM-DD'),
              endTime: endTime.format('HH:mm'),
            }
          : null

    if (!completionAt) {
      setBusy(false)
      setError('Tanggal dan jam selesai wajib diisi jika Waktu Saat Ini dimatikan.')
      return
    }

    const combinedNote = buildCombinedNote(checkInNote, checkOutNote)
    const { error: doneError } = await completeRentalWithIncome(
      selectedId,
      totalGrossIncome,
      combinedNote,
      completionAt,
    )
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
    setUseCurrentTime(true)
    setEndDate(dayjs())
    setEndTime(dayjs())
    setCheckOutNote('')
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
            setUseCurrentTime(true)
            setEndDate(dayjs())
            setEndTime(dayjs())
            setCheckOutNote('')
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
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Chip size="small" label={`Mulai: ${selected.start_date}`} />
            {selected.end_date ? <Chip size="small" label={`Selesai: ${selected.end_date}`} /> : null}
            {downPayment > 0 ? (
              <Chip size="small" color="info" label={`DP: ${formatIdr(downPayment)}`} />
            ) : null}
          </Box>
        </Paper>
      ) : null}

      {checkInNote ? (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Catatan Check-in
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 1.5, mt: 0.5, borderRadius: 2, bgcolor: 'action.hover' }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {checkInNote}
            </Typography>
          </Paper>
        </Box>
      ) : null}

      {selected ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.75 }}>
            Referensi Tarif
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Berlangsung:{' '}
            <strong>
              {costBreakdown ? formatElapsed(costBreakdown.elapsedHours) : '—'}
            </strong>
            {selected.start_time ? (
              <Typography component="span" variant="caption" color="text.secondary"> (sejak {selected.start_date} {selected.start_time})</Typography>
            ) : null}
          </Typography>
          {costBreakdown ? (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                <Chip size="small" label={`${costBreakdown.fullDays}d × ${formatIdr(selected.v2_cars!.daily_rate!)} = ${formatIdr(costBreakdown.dailyCost)}`} />
                {costBreakdown.overtimeHours > 0 ? (
                  <Chip size="small" color="warning" label={`${costBreakdown.overtimeHours}h OT × ${formatIdr(overtimeRate)} = ${formatIdr(costBreakdown.overtimeCost)}`} />
                ) : null}
              </Box>
              {costBreakdown.overtimeHours > 0 ? (
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  Total: <strong>{formatIdr(costBreakdown.total)}</strong>
                </Typography>
              ) : null}
              {downPayment > 0 ? (
                <Typography variant="body2">
                  Sisa tagihan: <strong>{formatIdr(Math.max(0, costBreakdown.total - downPayment))}</strong>
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">Hanya referensi — masukkan jumlah aktual di bawah.</Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {selected.v2_cars?.daily_rate == null ? 'Tarif harian belum diatur untuk kendaraan ini.' : null}
            </Typography>
          )}
        </Paper>
      ) : null}

      <TextField
        size="small"
        label="Pendapatan kotor saat selesai (IDR)"
        value={gross}
        onChange={(e) => setGross(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        fullWidth
        disabled={!selectedId}
        helperText={
          downPayment > 0
            ? `DP ${formatIdr(downPayment)} akan ditambahkan otomatis.`
            : 'Masukkan sisa tagihan yang diterima dari penyewa.'
        }
      />

      {selectedId && gross ? (
        <Typography variant="body2" color="text.secondary">
          Total pendapatan kotor:{' '}
          <strong>{formatIdr(downPayment + Number(gross.replace(/\D/g, '') || 0))}</strong>
        </Typography>
      ) : null}

      <FormControlLabel
        control={
          <Switch
            checked={useCurrentTime}
            onChange={(_, v) => setUseCurrentTime(v)}
            size="small"
            disabled={!selectedId}
          />
        }
        label="Waktu Saat Ini"
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <DatePicker
          label="Tanggal selesai"
          value={endDate}
          onChange={(v) => setEndDate(v)}
          disabled={!selectedId || useCurrentTime}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />
        <TimePicker
          label="Jam selesai (24 jam)"
          value={endTime}
          onChange={(v) => setEndTime(v)}
          ampm={false}
          disabled={!selectedId || useCurrentTime}
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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
        <Button variant="contained" color="success" onClick={() => void handleComplete()} disabled={busy || !selectedId}>
          {busy ? 'Menyelesaikan…' : 'Selesaikan sewa'}
        </Button>
      </Box>
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
