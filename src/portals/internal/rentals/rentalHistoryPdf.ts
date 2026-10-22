import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatIdr } from '../../../lib/formatIdr'

const MUTED: [number, number, number] = [100, 100, 100]
const GREEN: [number, number, number] = [46, 125, 50]
const ORANGE: [number, number, number] = [230, 81, 0]
const BORDER: [number, number, number] = [220, 220, 220]
const INK: [number, number, number] = [20, 20, 20]

const ID_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export type RentalHistoryPdfCar = {
  name: string
  plate: string
}

/**
 * One report line. `durationLabel` / `statusLabel` are rendered by the Sewa tab, so the
 * report always reads the same as the table it was downloaded from.
 */
export type RentalHistoryPdfRow = {
  renter_name: string
  renter_phone: string | null
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  down_payment: number | null
  gross_income: number | null
  status: string
  statusLabel: string
  durationLabel: string
}

/** "2026-10" → "Oktober 2026"; falls back to the raw value if it is not a month key. */
export function monthLabelId(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return month
  return `${ID_MONTHS[m - 1]} ${y}`
}

/** "2026-10-20" + "08:00:00" → "20-10-2026 08:00"; '—' when there is no date. */
export function formatRentalDateTime(date: string | null, time: string | null): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  const hhmm = time?.trim() ? time.trim().slice(0, 5) : ''
  return hhmm ? `${d}-${m}-${y} ${hhmm}` : `${d}-${m}-${y}`
}

function sumTotals(rentals: RentalHistoryPdfRow[]) {
  let totalDp = 0
  let totalGross = 0
  let completed = 0
  let active = 0
  let cancelled = 0
  for (const r of rentals) {
    totalDp += Number(r.down_payment ?? 0)
    totalGross += Number(r.gross_income ?? 0)
    const s = r.status.toLowerCase().trim()
    if (s === 'completed') completed += 1
    else if (s === 'active') active += 1
    else if (s === 'cancelled') cancelled += 1
  }
  return { totalDp, totalGross, completed, active, cancelled }
}

function slugFilename(plate: string, month: string): string {
  const safe = plate.replace(/[^\w.-]+/g, '_').slice(0, 40)
  return `Laporan-Sewa-${safe}-${month}.pdf`
}

/**
 * Monthly rental history for one car, scoped by rental start date — the month the
 * Sewa tab's picker is on.
 */
export function downloadRentalHistoryReport(opts: {
  companyName: string
  month: string
  car: RentalHistoryPdfCar
  rentals: RentalHistoryPdfRow[]
}): void {
  const { companyName, month, car, rentals } = opts

  const sorted = [...rentals].sort((a, b) => {
    const byDate = a.start_date.localeCompare(b.start_date)
    if (byDate !== 0) return byDate
    return (a.start_time ?? '').localeCompare(b.start_time ?? '')
  })

  const { totalDp, totalGross, completed, active, cancelled } = sumTotals(sorted)

  const generatedLabel = `Dibuat ${new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 18

  // ── Header ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text('Laporan Sewa', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(monthLabelId(month), margin, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(companyName, pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(generatedLabel, pageW - margin, y + 5, { align: 'right' })

  y += 16

  // ── Car info bar ──
  const barH = 16
  doc.setDrawColor(...BORDER)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(margin, y, pageW - 2 * margin, barH, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Kendaraan', margin + 3, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`${car.name} — ${car.plate}`, margin + 3, y + 11.5)
  doc.setFont('helvetica', 'normal')

  y += barH + 8

  // ── Summary cards ──
  const cardCount = 4
  const cardGap = 4
  const cardW = (pageW - 2 * margin - cardGap * (cardCount - 1)) / cardCount
  const drawCard = (ix: number, label: string, value: string, rgb: [number, number, number]) => {
    const x = margin + ix * (cardW + cardGap)
    doc.setDrawColor(...BORDER)
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x + 3, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...rgb)
    doc.text(value, x + 3, y + 14)
    doc.setFont('helvetica', 'normal')
  }

  drawCard(0, 'Jumlah sewa', `${sorted.length}`, INK)
  drawCard(1, 'Selesai / aktif / batal', `${completed} / ${active} / ${cancelled}`, INK)
  drawCard(2, 'Total DP', formatIdr(totalDp), ORANGE)
  drawCard(3, 'Pendapatan kotor', formatIdr(totalGross), GREEN)

  y += 22

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('RIWAYAT SEWA', margin, y)
  y += 4

  const body = sorted.map((r) => [
    r.renter_phone?.trim() ? `${r.renter_name}\n${r.renter_phone.trim()}` : r.renter_name,
    formatRentalDateTime(r.start_date, r.start_time),
    formatRentalDateTime(r.end_date, r.end_time),
    r.durationLabel,
    Number(r.down_payment ?? 0) > 0 ? formatIdr(Number(r.down_payment)) : '—',
    r.gross_income != null ? formatIdr(Number(r.gross_income)) : '—',
    r.statusLabel,
  ])

  autoTable(doc, {
    startY: y,
    head: [['Penyewa', 'Mulai', 'Selesai', 'Durasi', 'DP', 'Pendapatan Kotor', 'Status']],
    body: body.length ? body : [['—', '—', '—', 'Tidak ada sewa pada bulan ini', '—', '—', '—']],
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [50, 50, 50],
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [90, 90, 90],
      fontStyle: 'bold',
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 29 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 27 },
      6: { cellWidth: 18 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const r = sorted[data.row.index]
      if (!r) return
      const s = r.status.toLowerCase().trim()
      if (data.column.index === 5 && r.gross_income != null) {
        data.cell.styles.textColor = GREEN
      }
      if (data.column.index === 6) {
        if (s === 'completed') data.cell.styles.textColor = GREEN
        else if (s === 'cancelled') data.cell.styles.textColor = [150, 150, 150]
        else if (s === 'active') data.cell.styles.textColor = ORANGE
      }
    },
  })

  const ft = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  let footerY = (ft?.finalY ?? y + 40) + 10

  // ── Totals block (bottom-right) ──
  const blockW = 72
  const blockX = pageW - margin - blockW
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Total DP', blockX, footerY)
  doc.setTextColor(...ORANGE)
  doc.text(formatIdr(totalDp), pageW - margin, footerY, { align: 'right' })
  footerY += 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.text('Total pendapatan kotor', blockX, footerY)
  doc.setTextColor(...GREEN)
  doc.text(formatIdr(totalGross), pageW - margin, footerY, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  // ── Footer on every page ──
  const pageH = doc.internal.pageSize.getHeight()
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(
      'Laporan ini dibuat otomatis. Pendapatan kotor hanya tercatat untuk sewa yang sudah selesai.',
      margin,
      pageH - 10,
    )
    doc.text(`Halaman ${p} dari ${pageCount}`, pageW - margin, pageH - 10, { align: 'right' })
  }

  doc.save(slugFilename(car.plate, month))
}
