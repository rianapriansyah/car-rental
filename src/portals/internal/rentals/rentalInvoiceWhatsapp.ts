import { formatIdr } from '../../../lib/formatIdr'
import { formatElapsedDuration } from '../../../lib/formatDuration'
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

const formatElapsedLabel = formatElapsedDuration

// ─── WhatsApp message builder ─────────────────────────────────────────────────

export function buildInvoiceWhatsAppMessage(
  rental: InvoiceRentalInput,
  totals: InvoiceTotals,
  bankAccount = '',
): string {
  const {
    days,
    dailyRate,
    dailyCost,
    overtimeHours,
    overtimeRate,
    overtimeCost,
    subtotal,
    dp,
    sisaTagihan,
    driverFee,
    elapsedHours,
  } = totals
  const carLabel = rental.v2_cars
    ? `${rental.v2_cars.name} (${rental.v2_cars.plate})`
    : 'kendaraan'

  const elapsedStr = elapsedHours > 0 ? formatElapsedLabel(elapsedHours) : '—'

  const showBreakdown = overtimeHours > 0 && overtimeCost > 0

  const lines: (string | null)[] = [
    `Halo ${rental.renter_name},`,
    ``,
    `Berikut tagihan sewa ${carLabel}:`,
    ``,
    `*Mulai*: ${fmtDateTime(rental.start_date, rental.start_time)}`,
    rental.end_date ? `*Jatuh Tempo*: ${fmtDate(rental.end_date)}` : null,
    `*Durasi berjalan*: ${elapsedStr}`,
    ``,
    showBreakdown
      ? `${days} hari × ${formatIdr(dailyRate)}: ${formatIdr(dailyCost)}`
      : null,
    showBreakdown
      ? `${overtimeHours} jam OT × ${formatIdr(overtimeRate)}: ${formatIdr(overtimeCost)}`
      : null,
    driverFee > 0 ? `*Biaya sopir*: ${formatIdr(driverFee)}` : null,
    `*Total*: ${formatIdr(subtotal)}`,
    dp > 0 ? `*DP*: ${formatIdr(dp)}` : null,
    `*Sisa Tagihan*: ${formatIdr(sisaTagihan)}`,
    ``,
    sisaTagihan > 0
      ? `Terima kasih.`
      : `Tidak ada tagihan untuk dibayar. Terima kasih!`,
    bankAccount.trim() ? `\n*Pembayaran ke:*\n${bankAccount.trim()}` : null,
  ]

  return lines.filter((l): l is string => l !== null).join('\n')
}
