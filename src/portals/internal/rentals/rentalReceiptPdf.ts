import { jsPDF } from 'jspdf'
import { formatIdr } from '../../../lib/formatIdr'
import { generateReceiptQrDataUrl } from '../../../lib/receiptQr'
import type { RentalWithCar } from '../../../types/rental'
import {
  buildDetailRows,
  buildReceiptLineItems,
  formatReceiptDateTime,
  formatReceiptToday,
  receiptNumber,
  receiptTotal,
} from './rentalReceiptFormat'

const MUTED: [number, number, number] = [100, 100, 100]
const BORDER: [number, number, number] = [220, 220, 220]
const GREEN: [number, number, number] = [46, 125, 50]

const LEGAL_FOOTER =
  'Kuitansi ini dibuat secara elektronik oleh sistem dan berlaku sebagai bukti pembayaran sewa kendaraan yang sah sesuai data yang tercatat.'

function slugPart(s: string, max = 32): string {
  return s.replace(/[^\w.-]+/g, '_').slice(0, max) || 'sewa'
}

export function rentalReceiptPdfFilename(rental: RentalWithCar): string {
  const plate = rental.v2_cars?.plate ?? 'tanpa-plat'
  const idBit = rental.id.replace(/-/g, '').slice(0, 8)
  return `Kuitansi-${slugPart(plate)}-${idBit}.pdf`
}

function drawLine(doc: jsPDF, margin: number, y: number, pageW: number) {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(margin, y, pageW - margin, y)
}

/** Builds and triggers download of a rental receipt PDF (content mirrors the on-screen kuitansi). */
export async function downloadRentalReceiptPdf(
  rental: RentalWithCar,
  companyName: string,
  adminNumber = '',
  verificationUrl?: string,
): Promise<void> {
  const qrDataUrl =
    verificationUrl && verificationUrl.trim().length > 0
      ? await generateReceiptQrDataUrl(verificationUrl.trim())
      : undefined

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  const contentW = pageW - 2 * margin
  const titleY = 18
  let y = titleY

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('Kuitansi Sewa', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(companyName, margin, y + 6)

  let leftColumnBottom = y + 6
  const admin = adminNumber.trim()
  if (admin.length > 0) {
    doc.setFontSize(9)
    doc.text(admin, margin, y + 11)
    leftColumnBottom = y + 11
  }

  const num = receiptNumber(rental)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GREEN)
  doc.text('Selesai', pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text(num, pageW - margin, y + 6, { align: 'right' })

  const rightBlockBottom = y + 6
  y = Math.max(leftColumnBottom, rightBlockBottom) + 5
  drawLine(doc, margin, y, pageW)
  y += 8

  const section = (label: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), margin, y)
    y += 5
  }

  section('Penyewa')
  const issued = formatReceiptToday()
  const penyewaTop = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(rental.renter_name, margin, y)
  y += 5
  if (rental.renter_phone) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(rental.renter_phone, margin, y)
    y += 6
  } else {
    y += 1
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Tanggal kuitansi', pageW - margin, penyewaTop, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text(issued, pageW - margin, penyewaTop + 5, { align: 'right' })

  y = Math.max(y, penyewaTop + 11)
  y += 4
  drawLine(doc, margin, y, pageW)
  y += 8

  section('Kendaraan')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(rental.v2_cars?.name ?? '—', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(rental.v2_cars?.plate ?? '', margin, y)
  y += 8

  const startLabel = formatReceiptDateTime(rental.start_date, rental.start_time)
  const endLabel = rental.end_date ? formatReceiptDateTime(rental.end_date, rental.end_time) : '—'
  const half = (contentW - 4) / 2
  const barY = y
  doc.setDrawColor(...BORDER)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, barY, half, 16, 1.5, 1.5, 'FD')
  doc.roundedRect(margin + half + 4, barY, half, 16, 1.5, 1.5, 'FD')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Mulai', margin + 3, barY + 5)
  doc.text('Selesai', margin + half + 7, barY + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  doc.text(startLabel, margin + 3, barY + 11, { maxWidth: half - 4 })
  doc.text(endLabel, margin + half + 7, barY + 11, { maxWidth: half - 4 })
  y = barY + 20

  drawLine(doc, margin, y, pageW)
  y += 8

  section('Rincian')
  const lineItems = buildReceiptLineItems(rental)
  const payRows = buildDetailRows(rental)

  const colDurasi = margin + 54
  const colTarifR = margin + 98
  const colTotalR = pageW - margin
  const lineH = 5.8

  if (lineItems.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Item', margin, y)
    doc.text('Durasi', colDurasi, y)
    doc.text('Tarif Harian', colTarifR, y, { align: 'right' })
    doc.text('Total', colTotalR, y, { align: 'right' })
    y += lineH * 0.65
    drawLine(doc, margin, y, pageW)
    y += lineH * 0.85

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    for (const ln of lineItems) {
      doc.text(ln.item, margin, y, { maxWidth: 48 })
      doc.text(ln.durasi, colDurasi, y)
      doc.setFont('helvetica', 'bold')
      doc.text(ln.tarifHarian, colTarifR, y, { align: 'right' })
      doc.text(ln.total, colTotalR, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += lineH
    }
    y += 2
  }

  for (let i = 0; i < payRows.length; i++) {
    const r = payRows[i]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(r.key, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.text(r.value, pageW - margin, y, { align: 'right' })
    y += 6
  }

  y += 4
  drawLine(doc, margin, y, pageW)
  y += 8

  const total = receiptTotal(rental)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text('Total dibayar', margin, y)
  doc.setFontSize(14)
  doc.text(total > 0 ? formatIdr(total) : '—', pageW - margin, y, { align: 'right' })
  y += 10

  const note = rental.manual_note?.trim()
  if (note) {
    drawLine(doc, margin, y, pageW)
    y += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Catatan', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    const noteLines = doc.splitTextToSize(note, contentW)
    doc.text(noteLines, margin, y)
    y += noteLines.length * 4 + 4
  }

  if (qrDataUrl) {
    const qrMm = 32
    const qrX = pageW - margin - qrMm
    doc.addImage(qrDataUrl, 'PNG', qrX, y, qrMm, qrMm)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('Pindai untuk verifikasi', pageW - margin, y + qrMm + 3.5, { align: 'right' })
    y += qrMm + 8
  }

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('Terima kasih telah menyewa.', pageW / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const legalLines = doc.splitTextToSize(LEGAL_FOOTER, contentW)
  doc.text(legalLines, margin, y)

  doc.save(rentalReceiptPdfFilename(rental))
}
