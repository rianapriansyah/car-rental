import { formatIdr } from '../../../lib/formatIdr'
import type { RentalWithCar } from '../../../types/rental'

export function formatReceiptDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Tanggal kuitansi: hari ini (saat kuitansi dibuat / dicetak / diekspor PDF). */
export function formatReceiptToday(): string {
  const d = new Date()
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatReceiptDateTime(dateStr: string, timeStr: string | null | undefined): string {
  const date = formatReceiptDate(dateStr)
  if (timeStr != null && String(timeStr).trim() !== '') {
    return `${date}, ${String(timeStr).trim()}`
  }
  return date
}

export function receiptNumber(row: RentalWithCar): string {
  const compact = row.id.replace(/-/g, '').slice(0, 10).toUpperCase()
  return `#RNT-${compact}`
}

export function rentalDurationDays(row: RentalWithCar): number {
  if (row.duration_days != null && row.duration_days > 0) return row.duration_days
  const start = new Date(`${row.start_date}T12:00:00`)
  const end = row.end_date ? new Date(`${row.end_date}T12:00:00`) : new Date()
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

export type ReceiptDetailRow = {
  key: string
  value: string
}

/** Baris rincian: kiri = label, kanan = nilai (tanpa tarif acuan). */
export function buildDetailRows(row: RentalWithCar): ReceiptDetailRow[] {
  const out: ReceiptDetailRow[] = []
  const days = rentalDurationDays(row)
  out.push({ key: 'Durasi sewa', value: `${days} hari` })

  const dp = Number(row.down_payment ?? 0)
  const gross = Number(row.gross_income ?? 0)

  if (dp > 0 && gross > dp) {
    out.push({ key: 'Uang muka (DP)', value: formatIdr(dp) })
    out.push({ key: 'Pelunasan', value: formatIdr(gross - dp) })
  } else if (dp > 0 && gross === dp) {
    out.push({ key: 'Pembayaran', value: formatIdr(gross) })
  } else if (gross > 0) {
    out.push({ key: 'Pembayaran', value: formatIdr(gross) })
  }

  return out
}

export function receiptTotal(row: RentalWithCar): number {
  return Number(row.gross_income ?? 0)
}
