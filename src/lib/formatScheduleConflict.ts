import type { AvailabilityConflict } from './carAvailability'

const SOURCE_LABEL: Record<string, string> = {
  order: 'Pesanan',
  rental: 'Sewa aktif',
}

/** e.g. 2026-04-01 → 1 April 2026 (locale id-ID) */
export function formatIdLongDate(isoYmd: string): string {
  const parts = isoYmd.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return isoYmd
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
}

/** One line per conflict for alerts / error text. */
export function formatAvailabilityConflictLines(rows: AvailabilityConflict[]): string {
  return rows
    .map((r) => {
      const who = (r.renter_name?.trim() || 'Tanpa nama').trim()
      const kind = SOURCE_LABEL[r.source] ?? r.source
      const startLbl = formatIdLongDate(r.start_date)
      const endLbl = formatIdLongDate(r.end_date)
      return `${kind} · ${who}: ${startLbl} – ${endLbl}`
    })
    .join('\n')
}

/** Full message for schedule conflict alerts (Indonesian). */
export function formatAvailabilityConflictMessage(rows: AvailabilityConflict[]): string {
  if (rows.length === 0) return ''
  return `Rentang ini bertabrakan dengan:\n${formatAvailabilityConflictLines(rows)}`
}
