import { formatIdr } from '../../../lib/formatIdr'
import type { InvoiceRentalInput, InvoiceTotals } from './rentalInvoicePdf'

// ─── Helpers (private) ────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateTime(dateStr: string | null, timeStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const base = fmtDate(dateStr)
  const t = timeStr?.trim()
  return t ? `${base}, ${t.slice(0, 5)}` : base
}

function formatElapsedLabel(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const days = Math.floor(totalMin / 1440)
  const remH = Math.floor((totalMin % 1440) / 60)
  const remM = totalMin % 60
  const sub: string[] = []
  if (remH > 0) sub.push(`${remH}j`)
  if (remM > 0) sub.push(`${remM}m`)
  if (days > 0) {
    return sub.length > 0 ? `${days} hari (${sub.join(' ')})` : `${days} hari`
  }
  return sub.length > 0 ? sub.join(' ') : `${remM}m`
}

function elapsedHoursFromNow(rental: InvoiceRentalInput): number {
  const startStr = `${rental.start_date}T${rental.start_time ?? '00:00:00'}`
  const diffMs = Date.now() - new Date(startStr).getTime()
  return Math.max(0, diffMs / 3_600_000)
}

// ─── WhatsApp message builder ─────────────────────────────────────────────────

export function buildInvoiceWhatsAppMessage(
  rental: InvoiceRentalInput,
  totals: InvoiceTotals,
  bankAccount = '',
): string {
  const { subtotal, dp, sisaTagihan } = totals
  const carLabel = rental.v2_cars
    ? `${rental.v2_cars.name} (${rental.v2_cars.plate})`
    : 'kendaraan'

  const elapsed = elapsedHoursFromNow(rental)
  const elapsedStr = elapsed > 0 ? formatElapsedLabel(elapsed) : '—'

  const lines: (string | null)[] = [
    `Halo ${rental.renter_name},`,
    ``,
    `Berikut tagihan sewa ${carLabel}:`,
    ``,
    `📅 Mulai          : ${fmtDateTime(rental.start_date, rental.start_time)}`,
    rental.end_date ? `📅 Jatuh Tempo    : ${fmtDate(rental.end_date)}` : null,
    `⏱ Durasi berjalan : ${elapsedStr}`,
    ``,
    `💰 Total           : ${formatIdr(subtotal)}`,
    dp > 0 ? `💳 DP              : ${formatIdr(dp)}` : null,
    `🧾 Sisa Tagihan    : ${formatIdr(sisaTagihan)}`,
    ``,
    sisaTagihan > 0
      ? `Terima kasih 🙏`
      : `Tidak ada tagihan untuk dibayar. Terima kasih! 🙏`,
    bankAccount.trim() ? `\n🏦 Pembayaran ke:\n${bankAccount.trim()}` : null,
  ]

  return lines.filter((l): l is string => l !== null).join('\n')
}
