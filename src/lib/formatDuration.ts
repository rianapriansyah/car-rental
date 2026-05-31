/**
 * Formats a total-minutes value as Indonesian "X hari, Y jam, Z menit".
 * Zero-value components are omitted (e.g. exactly 2 days → "2 hari").
 */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—'
  const days = Math.floor(totalMinutes / (60 * 24))
  const remH = Math.floor((totalMinutes % (60 * 24)) / 60)
  const remM = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days} hari`)
  if (remH > 0) parts.push(`${remH} jam`)
  if (remM > 0) parts.push(`${remM} menit`)
  return parts.length > 0 ? parts.join(', ') : '—'
}

/** Converts elapsed hours to "X hari, Y jam, Z menit". */
export function formatElapsedDuration(hours: number): string {
  return formatDuration(Math.round(hours * 60))
}
