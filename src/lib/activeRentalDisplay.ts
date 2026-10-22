/**
 * Shared presentation helpers for live "rental berjalan" displays (TV kiosk, lobby tablet).
 * Pricing itself stays in rentalCost / driverFee — this only assembles the row figures.
 */
import dayjs from 'dayjs'
import { calcDriverFeeVariantA } from './driverFee'
import { calcCost, type CostBreakdown } from './rentalCost'
import { elapsedHoursRentalReference } from './rentalElapsedHours'

export const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** "Senin, 21-10-2026 14:30"; '—' when there is no date, '--:--' when there is no time. */
export function formatDateTimeId(date: string | null, time: string | null): string {
  if (!date) return '—'
  const d = dayjs(date)
  return `${ID_DAYS[d.day()]}, ${d.format('DD-MM-YYYY')} ${time ? time.slice(0, 5) : '--:--'}`
}

/** Elapsed hours → "2h 1j 30m" / "13j 7m" (hari, jam, menit) */
export function formatElapsedCompact(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const remH = Math.floor((totalMinutes % (60 * 24)) / 60)
  const remM = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}h`)
  if (remH > 0 || days === 0) parts.push(`${remH}j`)
  if (remM > 0 || (days === 0 && remH === 0)) parts.push(`${remM}m`)
  return parts.join(' ')
}

/** IDR amount without the Rp prefix (e.g. 25.000) for inline breakdowns */
export function formatIdrPlain(amount: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(amount))
}

/** Minimal rental shape needed to price a rental that is still running. */
export type ActiveRentalPricingInput = {
  start_date: string
  start_time: string | null
  down_payment: number | null
  include_driver: boolean
  v2_cars: { daily_rate: number | null } | null
}

export type ActiveRentalTotals = {
  /** null when the car has no daily rate, or the rental starts in the future. */
  breakdown: CostBreakdown | null
  elapsedHours: number
  driverFee: number
  /** Down payment already recorded for this rental. */
  dp: number
  /** Vehicle cost + driver fee. */
  gross: number
  /** Outstanding amount after the down payment, never negative. */
  sisa: number
}

/**
 * Running figures for one active rental at instant `now` — the same numbers the TV
 * kiosk and the lobby tablet show.
 */
export function calcActiveRentalTotals(
  rental: ActiveRentalPricingInput,
  now: dayjs.Dayjs,
  overtimeRate: number,
  dailyDriverRate: number,
): ActiveRentalTotals {
  const dailyRate = rental.v2_cars?.daily_rate ?? 0
  let breakdown: CostBreakdown | null = null
  if (dailyRate && rental.start_date) {
    const startDt = dayjs(`${rental.start_date}T${rental.start_time ?? '00:00:00'}`)
    const elapsed = now.diff(startDt, 'hour', true)
    if (elapsed > 0) breakdown = calcCost(elapsed, dailyRate, overtimeRate)
  }

  const elapsedHours =
    breakdown != null
      ? breakdown.elapsedHours
      : elapsedHoursRentalReference(rental.start_date, rental.start_time, now.valueOf())

  const driverFee =
    elapsedHours > 0
      ? calcDriverFeeVariantA(elapsedHours, dailyDriverRate, !!rental.include_driver)
      : 0

  const dp = rental.down_payment ?? 0
  const gross = (breakdown?.total ?? 0) + driverFee

  return { breakdown, elapsedHours, driverFee, dp, gross, sisa: Math.max(0, gross - dp) }
}
