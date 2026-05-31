import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatIdr } from '../../../lib/formatIdr'
import { formatElapsedDuration } from '../../../lib/formatDuration'
import { calcDriverFeeVariantA } from '../../../lib/driverFee'
import { elapsedHoursRentalReference } from '../../../lib/rentalElapsedHours'
import { calcCost, type CostBreakdown } from '../../../lib/rentalCost'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceRentalInput = {
  id: string
  renter_name: string
  renter_phone: string | null
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  duration_days: number | null
  down_payment: number | null
  status: string
  include_driver?: boolean | null
  v2_cars: { name: string; plate: string; daily_rate: number | null } | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function invoiceNumber(rental: InvoiceRentalInput): string {
  const year = new Date().getFullYear()
  const compact = rental.id.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `INV-${year}-${compact}`
}

export function invoiceDays(rental: InvoiceRentalInput): number {
  if (rental.duration_days != null && rental.duration_days > 0) return rental.duration_days
  const start = new Date(`${rental.start_date}T12:00:00`)
  const end = rental.end_date ? new Date(`${rental.end_date}T12:00:00`) : new Date()
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

export type InvoiceTotals = {
  /** Elapsed hours from start to invoice reference instant (vehicle + driver). */
  elapsedHours: number
  /** Non-null when daily rate and elapsed support OT reference model. */
  costBreakdown: CostBreakdown | null
  /** Number of full days charged at daily rate (matches `calcCost.fullDays` when breakdown exists). */
  days: number
  /** Daily rate at time of billing. */
  dailyRate: number
  /** Cost of the daily portion only (`days × dailyRate` in OT model). */
  dailyCost: number
  /** Hours of overtime billed (already ceiled per segment). */
  overtimeHours: number
  /** Overtime hourly rate used for the calculation. */
  overtimeRate: number
  /** Cost of the overtime portion only (`overtimeHours × overtimeRate`). */
  overtimeCost: number
  /** Vehicle subtotal only (before driver package). */
  vehicleSubtotal: number
  /** Driver surcharge (Variant A); 0 when not included. */
  driverFee: number
  /** Vehicle + driver, before DP. */
  subtotal: number
  /** Down payment recorded for this rental. */
  dp: number
  /** Outstanding amount: `max(0, subtotal − dp)`. */
  sisaTagihan: number
}

/**
 * Compute totals for an invoice in a way that **matches the on-screen "Referensi Tarif"
 * and the generated PDF**. Pass `overtimeRate` so OT can be billed correctly; omitting
 * it falls back to a flat `days × dailyRate` calculation.
 */
export function calcInvoiceTotals(
  rental: InvoiceRentalInput,
  overtimeRate = 0,
  dailyDriverRate = 0,
  referenceMs?: number,
): InvoiceTotals {
  const until = referenceMs ?? Date.now()
  const dailyRate = rental.v2_cars?.daily_rate ?? 0
  const dp = Math.max(0, Number(rental.down_payment ?? 0))
  const elapsedHours = elapsedHoursRentalReference(rental.start_date, rental.start_time, until)

  let costBreakdown: CostBreakdown | null = null
  let days: number
  let vehicleSubtotal: number

  if (dailyRate > 0 && elapsedHours > 0) {
    costBreakdown = calcCost(elapsedHours, dailyRate, overtimeRate)
    days = costBreakdown.fullDays
    vehicleSubtotal = costBreakdown.total
  } else {
    days = invoiceDays(rental)
    vehicleSubtotal = days * dailyRate
  }

  const driverFee = calcDriverFeeVariantA(elapsedHours, dailyDriverRate, !!rental.include_driver)
  const subtotal = vehicleSubtotal + driverFee

  return {
    elapsedHours,
    costBreakdown,
    days,
    dailyRate,
    dailyCost: costBreakdown?.dailyCost ?? vehicleSubtotal,
    overtimeHours: costBreakdown?.overtimeHours ?? 0,
    overtimeRate,
    overtimeCost: costBreakdown?.overtimeCost ?? 0,
    vehicleSubtotal,
    driverFee,
    subtotal,
    dp,
    sisaTagihan: Math.max(0, subtotal - dp),
  }
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "5 hari, 4 jam, 30 menit" from elapsed hours */
const formatElapsedLabel = formatElapsedDuration

// ─── Palette ──────────────────────────────────────────────────────────────────
//
// Restrained palette: deep ink, calm neutrals, one warm amber accent.
// Tinted backgrounds are reserved for the hero card and the "amount due" pill.

type RGB = [number, number, number]

const INK: RGB = [24, 28, 36]
const MUTED: RGB = [110, 116, 124]
const MUTED_LIGHT: RGB = [165, 170, 178]
const HAIRLINE: RGB = [228, 228, 232]
const SOFT: RGB = [248, 248, 250]

const AMBER: RGB = [217, 119, 6]
const AMBER_DEEP: RGB = [120, 53, 15]
const AMBER_TINT: RGB = [255, 247, 230]
const AMBER_LINE: RGB = [248, 222, 175]

const GREEN: RGB = [22, 101, 52]
const GREEN_TINT: RGB = [220, 252, 231]
const RED: RGB = [159, 18, 57]
const RED_TINT: RGB = [254, 226, 226]

// ─── Drawing helpers ──────────────────────────────────────────────────────────

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
  // jsPDF persists charSpace via the `Tc` graphics state op; reset so subsequent
  // text isn't accidentally letter-spaced.
  doc.setCharSpace(0)
}

// ─── PDF generator ────────────────────────────────────────────────────────────

export function generateRentalInvoicePdf(
  rental: InvoiceRentalInput,
  companyName: string,
  bankAccount = '',
  overtimeRate = 0,
  dailyDriverRate = 0,
  adminNumber = '',
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 16
  const contentW = pageW - 2 * M

  const totals = calcInvoiceTotals(rental, overtimeRate, dailyDriverRate)
  const {
    subtotal,
    sisaTagihan,
    dp,
    driverFee,
    elapsedHours,
    costBreakdown: bd,
    dailyRate,
  } = totals
  const elapsedLabel =
    bd != null
      ? formatElapsedLabel(bd.elapsedHours)
      : elapsedHours > 0
        ? formatElapsedLabel(elapsedHours)
        : '—'
  const isPaid = sisaTagihan <= 0 && subtotal > 0

  const invNum = invoiceNumber(rental)
  const todayStr = fmtDate(new Date().toISOString().slice(0, 10))
  const dueStr = rental.end_date ? fmtDate(rental.end_date) : '—'
  const carName = rental.v2_cars?.name ?? '—'
  const plate = rental.v2_cars?.plate ?? '—'

  // ══════════════════════════════════════════════════════════════════════════
  // TOP ACCENT — slim full-bleed amber stripe
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...AMBER)
  doc.rect(0, 0, pageW, 2.4, 'F')

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER — Company (left) · INVOICE wordmark + number (right)
  // ══════════════════════════════════════════════════════════════════════════
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
  doc.setFontSize(28)
  doc.setTextColor(...INK)
  doc.text('INVOICE', pageW - M, y + 4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text(invNum, pageW - M, y + 11, { align: 'right' })

  y += adminTrim ? 28 : 22
  hline(doc, y, M, pageW - M, HAIRLINE, 0.3)
  y += 9

  // ══════════════════════════════════════════════════════════════════════════
  // META ROW — Tagihan Kepada · Tanggal · Jatuh Tempo
  // ══════════════════════════════════════════════════════════════════════════
  const colA = M
  const colB = M + 86
  const colC = pageW - M

  smallCaps(doc, 'Tagihan Kepada', colA, y)
  smallCaps(doc, 'Tanggal Tagihan', colB, y)
  smallCaps(doc, 'Jatuh Tempo', colC, y, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(rental.renter_name, colA, y + 7)
  doc.text(todayStr, colB, y + 7)
  doc.text(dueStr, colC, y + 7, { align: 'right' })

  if (rental.renter_phone) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(rental.renter_phone, colA, y + 13)
  }

  y += 22

  // ══════════════════════════════════════════════════════════════════════════
  // HERO CARD — Rental at a glance + total tagihan
  // ══════════════════════════════════════════════════════════════════════════
  const cardX = M
  const cardY = y
  const cardH = 40
  const padX = 11

  // Soft amber background, gently rounded
  doc.setFillColor(...AMBER_TINT)
  doc.roundedRect(cardX, cardY, contentW, cardH, 3, 3, 'F')

  // Left accent bar (amber slab) — overlay the rounded fill on the right edge
  doc.setFillColor(...AMBER)
  doc.roundedRect(cardX, cardY, 2.4, cardH, 1.2, 1.2, 'F')
  doc.setFillColor(...AMBER_TINT)
  doc.rect(cardX + 1.2, cardY, 1.2, cardH, 'F')

  // Top labels — small caps in deep amber
  smallCaps(doc, 'Rental', cardX + padX, cardY + 8, { color: AMBER_DEEP })
  smallCaps(doc, 'Total Tagihan', cardX + contentW - padX, cardY + 8, {
    color: AMBER_DEEP,
    align: 'right',
  })

  // Car name + plate chip (left)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text(carName, cardX + padX, cardY + 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const plateText = plate
  const plateTW = doc.getTextWidth(plateText)
  const plateChipW = plateTW + 7
  const plateChipX = cardX + padX
  const plateChipY = cardY + 20.5
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.35)
  doc.roundedRect(plateChipX, plateChipY, plateChipW, 6, 1.2, 1.2, 'FD')
  doc.setTextColor(...AMBER_DEEP)
  doc.text(plateText, plateChipX + 3.5, plateChipY + 4.2)

  // Total amount (right) — large, bold, ink
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(formatIdr(subtotal), cardX + contentW - padX, cardY + 18, { align: 'right' })

  // Bottom strip — Mulai · Durasi
  const stripY = cardY + cardH - 11
  doc.setDrawColor(...AMBER_LINE)
  doc.setLineWidth(0.25)
  doc.line(cardX + padX, stripY, cardX + contentW - padX, stripY)

  smallCaps(doc, 'Mulai Sewa', cardX + padX, stripY + 4, { color: MUTED })
  smallCaps(doc, 'Durasi Berjalan', cardX + padX + 60, stripY + 4, { color: MUTED })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(fmtDate(rental.start_date), cardX + padX, stripY + 8.5)
  doc.text(elapsedLabel, cardX + padX + 60, stripY + 8.5)

  y = cardY + cardH + 12

  // ══════════════════════════════════════════════════════════════════════════
  // ITEM TABLE
  // ══════════════════════════════════════════════════════════════════════════
  smallCaps(doc, 'Rincian Item', M, y)
  y += 1.5

  type TableRow = [string, string, string, string]
  const tableRows: TableRow[] = []

  if (bd) {
    tableRows.push([
      `${carName} · ${plate}`,
      `${bd.fullDays} hari`,
      formatIdr(dailyRate),
      formatIdr(bd.dailyCost),
    ])
    if (bd.overtimeHours > 0 && overtimeRate > 0) {
      tableRows.push([
        'Overtime',
        `${bd.overtimeHours} jam`,
        formatIdr(overtimeRate),
        formatIdr(bd.overtimeCost),
      ])
    }
    if (driverFee > 0 && dailyDriverRate > 0) {
      tableRows.push([
        'Biaya sopir',
        formatElapsedLabel(elapsedHours),
        formatIdr(dailyDriverRate) + ' /hari',
        formatIdr(driverFee),
      ])
    }
  } else {
    const days = invoiceDays(rental)
    tableRows.push([
      `${carName} · ${plate}`,
      `${days} hari`,
      dailyRate > 0 ? formatIdr(dailyRate) : '—',
      dailyRate > 0 ? formatIdr(days * dailyRate) : '—',
    ])
    if (driverFee > 0 && dailyDriverRate > 0) {
      tableRows.push([
        'Biaya sopir',
        formatElapsedLabel(elapsedHours),
        formatIdr(dailyDriverRate) + ' /hari',
        formatIdr(driverFee),
      ])
    }
  }

  autoTable(doc, {
    startY: y + 2,
    head: [['Deskripsi', 'Jumlah', 'Harga', 'Total']],
    body: tableRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      textColor: INK,
      lineColor: HAIRLINE,
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: MUTED_LIGHT,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 2, bottom: 4, left: 4, right: 4 },
      lineWidth: { bottom: 0.4 },
      lineColor: INK,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center', textColor: MUTED },
      2: { cellWidth: 36, halign: 'right', textColor: MUTED },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
    tableWidth: contentW,
  })

  const ft = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  y = (ft?.finalY ?? y + 30) + 10

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY — right-aligned, inline with table, no enclosing box
  // ══════════════════════════════════════════════════════════════════════════
  const sumW = 86
  const sumX = pageW - M - sumW
  const labelX = sumX
  const valueX = pageW - M

  function row(label: string, value: string, ty: number, opts: {
    bold?: boolean
    labelColor?: RGB
    valueColor?: RGB
    size?: number
  } = {}) {
    const { bold = false, labelColor = MUTED, valueColor = INK, size = 9.5 } = opts
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...labelColor)
    doc.text(label, labelX, ty)
    doc.setTextColor(...valueColor)
    doc.text(value, valueX, ty, { align: 'right' })
  }

  row('Subtotal', formatIdr(subtotal), y)
  y += 6.8
  if (dp > 0) {
    row('Down Payment', formatIdr(dp), y, { valueColor: GREEN })
    y += 6.8
  }

  hline(doc, y, sumX, pageW - M, INK, 0.3)
  y += 8

  // SISA TAGIHAN — bold, slightly larger row, no panel/box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text('Sisa Tagihan', labelX, y)
  doc.setFontSize(13)
  doc.text(formatIdr(sisaTagihan), valueX, y, { align: 'right' })

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER — Bank account (left) · Status pill (right) · sign-off
  // ══════════════════════════════════════════════════════════════════════════
  const footerTop = pageH - 40
  hline(doc, footerTop, M, pageW - M, HAIRLINE, 0.3)

  let fy = footerTop + 7
  smallCaps(doc, 'Pembayaran', M, fy)
  fy += 6

  if (bankAccount && bankAccount.trim().length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    const bankLines = doc.splitTextToSize(bankAccount.trim(), contentW - 60)
    const lines = Array.isArray(bankLines) ? bankLines : [bankLines]
    lines.slice(0, 3).forEach((line: string, i: number) => {
      if (i === 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...INK)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...MUTED)
      }
      doc.text(line, M, fy + i * 5)
    })
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED_LIGHT)
    doc.text('—', M, fy)
  }

  // Status pill (right)
  const pillTone = isPaid
    ? { bg: GREEN_TINT, fg: GREEN, label: 'LUNAS' }
    : sisaTagihan === 0 && subtotal === 0
      ? { bg: SOFT, fg: MUTED, label: 'DRAFT' }
      : { bg: RED_TINT, fg: RED, label: 'BELUM LUNAS' }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  const labelW = doc.getTextWidth(pillTone.label)
  const sPillW = labelW + 12
  const sPillH = 9
  const sPillX = pageW - M - sPillW
  const sPillY = footerTop + 6
  doc.setFillColor(...pillTone.bg)
  doc.setDrawColor(...pillTone.fg)
  doc.setLineWidth(0.3)
  doc.roundedRect(sPillX, sPillY, sPillW, sPillH, sPillH / 2, sPillH / 2, 'FD')
  doc.setTextColor(...pillTone.fg)
  doc.text(pillTone.label, sPillX + sPillW / 2, sPillY + 6, { align: 'center' })

  // Sign-off line at very bottom
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED_LIGHT)
  doc.text(
    'Terima kasih. Mohon cantumkan nomor invoice saat melakukan pembayaran.',
    M,
    pageH - 9,
  )
  doc.text(invNum, pageW - M, pageH - 9, { align: 'right' })

  // ── Save ─────────────────────────────────────────────────────────────────
  const safePlate = (rental.v2_cars?.plate ?? 'tanpa-plat').replace(/[^\w.-]+/g, '_')
  const idBit = rental.id.replace(/-/g, '').slice(0, 6)
  doc.save(`Tagihan-${safePlate}-${idBit}.pdf`)
}

