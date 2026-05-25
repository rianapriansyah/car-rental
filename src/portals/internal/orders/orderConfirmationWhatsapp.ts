import { formatIdr } from '../../../lib/formatIdr'
import {
  fmtOrderDate,
  fmtOrderDateTime,
  formatOrderTariffReference,
  ORDER_CONFIRMATION_LEGAL_FOOTER,
  orderCarLabel,
  orderProofNumber,
  type OrderConfirmationInput,
} from './orderConfirmationShared'

export function buildOrderConfirmationWhatsAppMessage(order: OrderConfirmationInput): string {
  const depositAmount =
    order.deposit_amount != null ? formatIdr(Number(order.deposit_amount)) : '—'
  const depositPaid = order.deposit_paid ? 'Ya' : 'Tidak'
  const notes = order.notes?.trim() ? order.notes.trim() : '—'

  const lines: (string | null)[] = [
    `Halo ${order.renter_name},`,
    ``,
    `Berikut bukti pesanan sewa ${orderCarLabel(order)}:`,
    ``,
    `*No. pesanan*: ${orderProofNumber(order)}`,
    `*Mulai*: ${fmtOrderDateTime(order.start_date, order.start_time)}`,
    order.end_date ? `*Selesai*: ${fmtOrderDate(order.end_date)}` : null,
    order.duration_days != null ? `*Durasi*: ${order.duration_days} hari` : null,
    `*Referensi tarif*: ${formatOrderTariffReference(order)}`,
    `*Deposit*: ${depositAmount}`,
    `*Deposit lunas*: ${depositPaid}`,
    order.notes?.trim() ? `*Catatan*: ${notes}` : null,
    ``,
    `Pesanan Anda telah *dikonfirmasi*. Terima kasih!`,
    ``,
    ORDER_CONFIRMATION_LEGAL_FOOTER,
  ]

  return lines.filter((l): l is string => l !== null).join('\n')
}
