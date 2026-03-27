import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TransactionRow } from '../types/transaction'
import type { TransactionCategory } from '../types/transaction'
import { formatIdr } from './formatIdr'

export type LedgerPdfCar = {
  name: string
  plate: string
  ownership_type: string
  partnerName: string | null
  hasGps: boolean
}

export type LedgerPdfRentalInfo = {
  renter_name: string
  start_date: string
  end_date: string | null
}

const MUTED: [number, number, number] = [100, 100, 100]
const GREEN: [number, number, number] = [46, 125, 50]
const ORANGE: [number, number, number] = [230, 81, 0]
const BORDER: [number, number, number] = [220, 220, 220]

function categoryLabel(cat: string): string {
  const map: Record<TransactionCategory, string> = {
    rental_income: 'Sewa',
    gps_topup: 'Isi GPS',
    maintenance: 'Perawatan',
    partner_fee: 'Biaya mitra',
    owner_withdrawal: 'Penarikan',
    other: 'Lainnya',
  }
  return map[cat as TransactionCategory] ?? cat
}

function rentalDurationDays(r: LedgerPdfRentalInfo): string {
  if (!r.end_date) return 'berlangsung'
  const start = new Date(`${r.start_date}T00:00:00`)
  const end = new Date(`${r.end_date}T00:00:00`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  return `${days} hari`
}

function buildDescription(t: TransactionRow, rental?: LedgerPdfRentalInfo): string {
  let base: string
  if (t.category === 'rental_income' && rental) {
    base = `Sewa — ${rental.renter_name} (${rentalDurationDays(rental)})`
  } else if (t.manual_note?.trim()) {
    base = t.manual_note.trim()
  } else {
    base = categoryLabel(t.category)
  }
  return t.auto_fee ? `${base} (auto)` : base
}

function typeLabel(type: string): string {
  return type === 'income' ? 'Pemasukan' : 'Pengeluaran'
}

function sumTotals(transactions: TransactionRow[]) {
  let totalIncome = 0
  let totalExpense = 0
  for (const t of transactions) {
    const amt = Number(t.amount)
    if (t.type === 'income') totalIncome += amt
    else totalExpense += amt
  }
  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
  }
}

function slugFilename(plate: string, month: string): string {
  const safe = plate.replace(/[^\w.-]+/g, '_').slice(0, 40)
  return `Rekap-${safe}-${month}.pdf`
}

export function downloadLedgerReport(opts: {
  companyName: string
  month: string
  car: LedgerPdfCar
  transactions: TransactionRow[]
  rentalById: Record<string, LedgerPdfRentalInfo>
}): void {
  const { companyName, month, car, transactions, rentalById } = opts
  const sorted = [...transactions].sort((a, b) => {
    const ta = a.recorded_at ?? ''
    const tb = b.recorded_at ?? ''
    return ta.localeCompare(tb)
  })

  const { totalIncome, totalExpense, netBalance } = sumTotals(sorted)

  const monthDate = new Date(`${month}-01T12:00:00`)
  const monthLabel = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const generatedLabel = `Generated ${new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text('Ledger Report', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(monthLabel, margin, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(companyName, pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(generatedLabel, pageW - margin, y + 5, { align: 'right' })

  y += 16

  // Car info bar
  const barH = 22
  doc.setDrawColor(...BORDER)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(margin, y, pageW - 2 * margin, barH, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Car', margin + 3, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`${car.name} — ${car.plate}`, margin + 3, y + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const ownershipBadge =
    car.ownership_type === 'partner' ? 'Milik mitra' : 'Milik perusahaan'
  doc.setFillColor(232, 245, 233)
  doc.setTextColor(...GREEN)
  doc.roundedRect(margin + 3, y + 14, 28, 5, 1, 1, 'F')
  doc.text(ownershipBadge, margin + 5, y + 17.5)

  doc.setTextColor(...MUTED)
  const partnerBit =
    car.ownership_type === 'partner' && car.partnerName
      ? `Partner: ${car.partnerName}`
      : car.ownership_type === 'partner'
        ? 'Partner: —'
        : ''
  if (partnerBit) {
    doc.text(partnerBit, margin + 34, y + 17.5)
  }
  const gpsBit = car.hasGps ? 'GPS terpasang' : 'Tanpa GPS'
  doc.text(gpsBit, margin + (partnerBit ? 92 : 34), y + 17.5)

  y += barH + 8

  // Summary cards
  const cardW = (pageW - 2 * margin - 8) / 3
  const cardGap = 4
  const drawCard = (ix: number, label: string, value: string, rgb: [number, number, number]) => {
    const x = margin + ix * (cardW + cardGap)
    doc.setDrawColor(...BORDER)
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x + 3, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...rgb)
    doc.text(value, x + 3, y + 14)
    doc.setFont('helvetica', 'normal')
  }

  drawCard(0, 'Total income', formatIdr(totalIncome), GREEN)
  drawCard(1, 'Total expense', formatIdr(totalExpense), ORANGE)
  drawCard(2, 'Net balance', formatIdr(netBalance), [20, 20, 20])

  y += 22

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('TRANSACTIONS', margin, y)
  y += 4

  const body = sorted.map((t) => {
    const dateStr = t.recorded_at
      ? new Date(t.recorded_at).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—'
    const rental = t.rental_id ? rentalById[t.rental_id] : undefined
    const desc = buildDescription(t, rental)
    const cat = categoryLabel(t.category)
    const tlabel = typeLabel(t.type)
    const amt =
      t.type === 'income'
        ? formatIdr(Number(t.amount))
        : `(${formatIdr(Number(t.amount)).replace(/^Rp\s?/, '')})`
    return [dateStr, desc, cat, tlabel, amt]
  })

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Category', 'Type', 'Amount (IDR)']],
    body: body.length ? body : [['—', 'No transactions', '—', '—', '—']],
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [50, 50, 50],
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [90, 90, 90],
      fontStyle: 'bold',
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 66 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { halign: 'right', cellWidth: 34 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const t = sorted[data.row.index]
      if (!t) return
      if (data.column.index === 3) {
        data.cell.styles.textColor = t.type === 'income' ? GREEN : [198, 40, 40]
      }
      if (data.column.index === 4) {
        data.cell.styles.textColor = t.type === 'income' ? GREEN : ORANGE
      }
    },
  })

  const ft = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  let footerY = (ft?.finalY ?? y + 40) + 10

  // Totals block (bottom-right)
  const blockW = 72
  const blockX = pageW - margin - blockW
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Total income', blockX, footerY)
  doc.setTextColor(...GREEN)
  doc.text(formatIdr(totalIncome), pageW - margin, footerY, { align: 'right' })
  footerY += 5
  doc.setTextColor(...MUTED)
  doc.text('Total expense', blockX, footerY)
  doc.setTextColor(...ORANGE)
  doc.text(`(${formatIdr(totalExpense)})`, pageW - margin, footerY, { align: 'right' })
  footerY += 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text('Net balance', blockX, footerY)
  doc.text(formatIdr(netBalance), pageW - margin, footerY, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(
    'This report was generated automatically. Rows marked (auto) are system-generated.',
    margin,
    pageH - 10,
  )
  doc.text('Page 1 of 1', pageW - margin, pageH - 10, { align: 'right' })

  doc.save(slugFilename(car.plate, month))
}

/** Matches `TransactionsPage` month window: UTC month start through first instant of next local calendar month. */
export function filterTransactionsByMonth(
  transactions: TransactionRow[],
  month: string,
): TransactionRow[] {
  const start = `${month}-01T00:00:00.000Z`
  const [y, m] = month.split('-').map(Number)
  const next = new Date(y, m, 1)
  const end = next.toISOString()
  return transactions.filter((t) => {
    if (!t.recorded_at) return false
    return t.recorded_at >= start && t.recorded_at < end
  })
}

export async function fetchLedgerRentalMap(
  supabase: SupabaseClient,
  rentalIds: string[],
): Promise<Record<string, LedgerPdfRentalInfo>> {
  const uniq = [...new Set(rentalIds.filter(Boolean))]
  if (uniq.length === 0) return {}
  const { data } = await supabase
    .from('v2_rentals')
    .select('id, renter_name, start_date, end_date')
    .in('id', uniq)
  const map: Record<string, LedgerPdfRentalInfo> = {}
  for (const r of data ?? []) {
    map[r.id] = {
      renter_name: r.renter_name,
      start_date: r.start_date,
      end_date: r.end_date,
    }
  }
  return map
}

/** PDF header company line; `v2_app_settings.key === 'company_name'`. */
export async function fetchCompanyDisplayName(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('v2_app_settings')
    .select('value')
    .eq('key', 'company_name')
    .maybeSingle()
  const v = data?.value?.trim()
  return v && v.length > 0 ? v : 'Your Rental Company'
}

export function currentMonthYyyyMm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
