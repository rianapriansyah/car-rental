import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatIdr } from '../../../lib/formatIdr'
import {
  fmtOrderDate,
  fmtOrderDateTime,
  formatOrderTariffReference,
  ORDER_CONFIRMATION_LEGAL_FOOTER,
  orderProofNumber,
  type OrderConfirmationInput,
} from './orderConfirmationShared'

type RGB = [number, number, number]

const INK: RGB = [24, 28, 36]
const MUTED: RGB = [110, 116, 124]
const MUTED_LIGHT: RGB = [165, 170, 178]
const HAIRLINE: RGB = [228, 228, 232]
const AMBER: RGB = [217, 119, 6]
const AMBER_DEEP: RGB = [120, 53, 15]
const AMBER_TINT: RGB = [255, 247, 230]
const AMBER_LINE: RGB = [248, 222, 175]
const BLUE: RGB = [29, 78, 216]
const BLUE_TINT: RGB = [219, 234, 254]

function hline(doc: jsPDF, y: number, x1: number, x2: number, color: RGB = HAIRLINE, lw = 0.2) {
  doc.setDrawColor(...color)
  doc.setLineWidth(lw)
  doc.line(x1, y, x2, y)
}

function smallCaps(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: { color?: RGB; size?: number; align?: 'left' | 'right' | 'center' } = {},
) {
  const { color = MUTED_LIGHT, size = 6.8, align = 'left' } = opts
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  doc.setTextColor(...color)
  doc.text(text.toUpperCase(), x, y, { align, charSpace: 0.4 })
  doc.setCharSpace(0)
}

export function generateOrderConfirmationPdf(
  order: OrderConfirmationInput,
  companyName: string,
  adminNumber = '',
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 16
  const contentW = pageW - 2 * M

  const proofNum = orderProofNumber(order)
  const todayStr = fmtOrderDate(new Date().toISOString().slice(0, 10))
  const carName = order.v2_cars?.name ?? '—'
  const plate = order.v2_cars?.plate ?? '—'
  const depositAmount =
    order.deposit_amount != null ? formatIdr(Number(order.deposit_amount)) : '—'
  const depositPaid = order.deposit_paid ? 'Ya' : 'Tidak'

  doc.setFillColor(...AMBER)
  doc.rect(0, 0, pageW, 2.4, 'F')

  let y = 18
  smallCaps(doc, 'Dari', M, y, { color: MUTED_LIGHT })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text(companyName, M, y + 7)

  const adminTrim = adminNumber.trim()
  if (adminTrim) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    doc.text(adminTrim, M, y + 14)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text('BUKTI PESANAN', pageW - M, y + 4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text(proofNum, pageW - M, y + 11, { align: 'right' })

  y += adminTrim ? 28 : 22
  hline(doc, y, M, pageW - M, HAIRLINE, 0.3)
  y += 9

  const colA = M
  const colB = M + 86
  const colC = pageW - M

  smallCaps(doc, 'Untuk', colA, y)
  smallCaps(doc, 'Tanggal', colB, y)
  smallCaps(doc, 'Status', colC, y, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(order.renter_name, colA, y + 7)
  doc.text(todayStr, colB, y + 7)
  doc.text('Dikonfirmasi', colC, y + 7, { align: 'right' })

  if (order.renter_phone) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(order.renter_phone, colA, y + 13)
  }

  y += 22

  const cardX = M
  const cardY = y
  const cardH = 34
  const padX = 11

  doc.setFillColor(...AMBER_TINT)
  doc.roundedRect(cardX, cardY, contentW, cardH, 3, 3, 'F')
  doc.setFillColor(...AMBER)
  doc.roundedRect(cardX, cardY, 2.4, cardH, 1.2, 1.2, 'F')
  doc.setFillColor(...AMBER_TINT)
  doc.rect(cardX + 1.2, cardY, 1.2, cardH, 'F')

  smallCaps(doc, 'Kendaraan', cardX + padX, cardY + 8, { color: AMBER_DEEP })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text(carName, cardX + padX, cardY + 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const plateTW = doc.getTextWidth(plate)
  const plateChipW = plateTW + 7
  const plateChipX = cardX + padX
  const plateChipY = cardY + 20.5
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.35)
  doc.roundedRect(plateChipX, plateChipY, plateChipW, 6, 1.2, 1.2, 'FD')
  doc.setTextColor(...AMBER_DEEP)
  doc.text(plate, plateChipX + 3.5, plateChipY + 4.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  const statusLabel = 'DIKONFIRMASI'
  const statusW = doc.getTextWidth(statusLabel) + 12
  const statusX = cardX + contentW - padX - statusW
  const statusY = cardY + 12
  doc.setFillColor(...BLUE_TINT)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.3)
  doc.roundedRect(statusX, statusY, statusW, 9, 4.5, 4.5, 'FD')
  doc.setTextColor(...BLUE)
  doc.text(statusLabel, statusX + statusW / 2, statusY + 6, { align: 'center' })

  y = cardY + cardH + 12

  smallCaps(doc, 'Detail Pesanan', M, y)
  y += 1.5

  const detailRows: [string, string][] = [
    ['Mulai', fmtOrderDateTime(order.start_date, order.start_time)],
    ['Selesai', order.end_date ? fmtOrderDate(order.end_date) : '—'],
    ['Durasi (hari)', order.duration_days != null ? String(order.duration_days) : '—'],
    ['Referensi tarif', formatOrderTariffReference(order)],
    ['Deposit', depositAmount],
    ['Deposit lunas', depositPaid],
    ['Catatan', order.notes?.trim() ? order.notes.trim() : '—'],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Rincian', 'Keterangan']],
    body: detailRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: HAIRLINE,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [248, 248, 250],
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 52, textColor: MUTED },
      1: { cellWidth: 'auto' },
    },
    margin: { left: M, right: M },
    tableWidth: contentW,
  })

  const ft = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  y = (ft?.finalY ?? y + 30) + 12

  hline(doc, y, M, pageW - M, HAIRLINE, 0.3)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const footerLines = doc.splitTextToSize(ORDER_CONFIRMATION_LEGAL_FOOTER, contentW)
  doc.text(footerLines, M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED_LIGHT)
  doc.text(proofNum, pageW - M, pageH - 9, { align: 'right' })

  const safePlate = (order.v2_cars?.plate ?? 'tanpa-plat').replace(/[^\w.-]+/g, '_')
  const idBit = order.id.replace(/-/g, '').slice(0, 6)
  doc.save(`Bukti-Pesanan-${safePlate}-${idBit}.pdf`)
}
