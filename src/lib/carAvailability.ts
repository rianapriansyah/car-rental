import dayjs from 'dayjs'
import { supabase } from './supabase'

export type AvailabilityConflict = {
  source: string
  start_date: string
  end_date: string
  /** Penyewa pada pesanan/sewa yang bentrok (dari RPC setelah migrasi). */
  renter_name: string | null
}

export async function checkCarAvailability(
  carId: string,
  start: string,
  end: string,
): Promise<{ rows: AvailabilityConflict[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('check_car_availability', {
    p_car_id: carId,
    p_start: start,
    p_end: end,
  })
  if (error) return { rows: [], error: new Error(error.message) }
  const rows: AvailabilityConflict[] = (data ?? []).map((r) => {
    const row = r as AvailabilityConflict & { renter_name?: string | null }
    return {
      source: row.source,
      start_date: row.start_date,
      end_date: row.end_date,
      renter_name: row.renter_name ?? null,
    }
  })
  return { rows, error: null }
}

export type CheckInOrderWarningResult = {
  /** Same calendar day as a confirmed order — block check-in. */
  blockMessage: string | null
  /** Rent start is within `warningDays` before an order's start (exclusive of order day). */
  warningMessage: string | null
}

/**
 * For check-in: compare rent start to each confirmed order on the car.
 * - Rent start same day as order → block (cannot start rental that day).
 * - Rent start in [orderStart - warningDays, orderStart) → soft warning only.
 */
export async function getCheckInOrderWarnings(
  carId: string,
  rentStartYmd: string,
  warningDays: number,
): Promise<CheckInOrderWarningResult> {
  const { data, error } = await supabase
    .from('v2_orders')
    .select('start_date')
    .eq('car_id', carId)
    .eq('status', 'confirmed')

  if (error) throw new Error(error.message)

  const rent = dayjs(rentStartYmd)
  const orders = data ?? []
  if (orders.length === 0) return { blockMessage: null, warningMessage: null }

  const orderDatesFormatted: string[] = []

  for (const o of orders) {
    const orderDay = dayjs(o.start_date)
    if (rent.isSame(orderDay, 'day')) {
      return {
        blockMessage: `Tanggal mulai sama dengan pesanan terkonfirmasi (${orderDay.format('D MMM YYYY')}). Tidak dapat memulai sewa pada tanggal ini.`,
        warningMessage: null,
      }
    }
    const windowStart = orderDay.subtract(warningDays, 'day')
    if (rent.isBefore(orderDay, 'day') && !rent.isBefore(windowStart, 'day')) {
      orderDatesFormatted.push(orderDay.format('D MMM YYYY'))
    }
  }

  if (orderDatesFormatted.length === 0) {
    return { blockMessage: null, warningMessage: null }
  }

  const unique = [...new Set(orderDatesFormatted)]
  return {
    blockMessage: null,
    warningMessage: `Tanggal mulai berada dalam ${warningDays} hari sebelum pesanan (${unique.join(', ')}). Pastikan jadwal tidak bentrok dengan komitmen pesanan.`,
  }
}

/**
 * Order form: soft warning when another confirmed order on this car starts in [today, today + warningDays].
 */
export async function hasUpcomingConfirmedOrderWarning(
  carId: string,
  warningDays: number,
): Promise<boolean> {
  const today = dayjs().format('YYYY-MM-DD')
  const until = dayjs().add(warningDays, 'day').format('YYYY-MM-DD')

  const { data, error } = await supabase
    .from('v2_orders')
    .select('id')
    .eq('car_id', carId)
    .eq('status', 'confirmed')
    .gte('start_date', today)
    .lte('start_date', until)
    .limit(1)

  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}
