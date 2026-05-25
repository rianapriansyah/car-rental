import { formatIdr } from '../../../lib/formatIdr'

/** Footer for bukti pesanan PDF / WhatsApp (replaces shared bank-account block). */
export const ORDER_CONFIRMATION_LEGAL_FOOTER =
  'Ini adalah bukti pemesanan yang sah. Tunjukkan bukti ini untuk pengambilan mobil.'

export type OrderConfirmationInput = {
  id: string
  renter_name: string
  renter_phone: string | null
  start_date: string
  start_time: string | null
  end_date: string | null
  duration_days: number | null
  deposit_amount: number | null
  deposit_paid: boolean | null
  notes: string | null
  v2_cars: { name: string; plate: string; daily_rate: number | null } | null
}

export function orderProofNumber(order: OrderConfirmationInput): string {
  const year = new Date().getFullYear()
  const compact = order.id.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `ORD-${year}-${compact}`
}

export function fmtOrderDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmtOrderDateTime(dateStr: string | null, timeStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const base = fmtOrderDate(dateStr)
  const t = timeStr?.trim()
  return t ? `${base}, ${t.slice(0, 5)}` : base
}

export function formatOrderTariffReference(order: OrderConfirmationInput): string {
  const rate = order.v2_cars?.daily_rate
  if (rate == null) return '—'
  if (order.duration_days != null) {
    return `${formatIdr(Number(rate) * order.duration_days)} (${order.duration_days} hari × ${formatIdr(Number(rate))})`
  }
  return `${formatIdr(Number(rate))} / hari`
}

export function orderCarLabel(order: OrderConfirmationInput): string {
  return order.v2_cars ? `${order.v2_cars.name} (${order.v2_cars.plate})` : '—'
}
