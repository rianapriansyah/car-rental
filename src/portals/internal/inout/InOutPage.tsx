import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
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
import { supabase } from '../../../lib/supabase'
import { completeRentalWithIncome } from '../../../lib/feeEngine'
import { formatIdr } from '../../../lib/formatIdr'
import { insertDownPaymentIncomeTransaction } from '../../../lib/rentalDownPaymentTxn'
import { calcCost, type CostBreakdown } from '../../../lib/rentalCost'
import { calcDriverFeeVariantA } from '../../../lib/driverFee'
import { fetchAdminNumberDisplay, fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { formatElapsedDuration } from '../../../lib/formatDuration'
import { buildWhatsAppMeUrlWithMessage } from '../../../lib/whatsappLink'
import {
  generateRentalInvoicePdf,
  calcInvoiceTotals,
} from '../../internal/rentals/rentalInvoicePdf'
import { buildInvoiceWhatsAppMessage } from '../../internal/rentals/rentalInvoiceWhatsapp'
import type { RentalWithCar } from '../../../types/rental'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { CheckInPanel } from './CheckInPanel'
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

const formatElapsed = formatElapsedDuration

/** Formats a raw digit string as Indonesian thousands-separated number, e.g. "300000" → "300.000" */
function fmtNumInput(raw: string): string {
  if (!raw) return ''
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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
  const [adminNumber, setAdminNumber] = useState('')
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
    void fetchAdminNumberDisplay(supabase).then(setAdminNumber)
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
    generateRentalInvoicePdf(selected, companyName, bankAccount, overtimeRate, dailyDriverRate, adminNumber)
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
        label="Sisa pembayaran di checkout"
        value={fmtNumInput(gross)}
        onChange={(e) => setGross(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        fullWidth
        disabled={!selectedId}
        slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment> } }}
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
        value={checkoutMileage ? checkoutMileage.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
        onChange={(e) => setCheckoutMileage(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        fullWidth
        disabled={!selectedId}
        slotProps={{ input: { startAdornment: <InputAdornment position="start">KM</InputAdornment> } }}
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
