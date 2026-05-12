/**
 * Fractional hours from rental start (date + time) to reference instant.
 */
export function elapsedHoursRentalReference(
  startDate: string,
  startTime: string | null | undefined,
  referenceMs: number,
): number {
  const raw = startTime?.trim()
  const t = raw ? raw.slice(0, 8) : '00:00'
  const norm = /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t
  const startStr = `${startDate}T${norm}`
  const diffMs = referenceMs - new Date(startStr).getTime()
  return Math.max(0, diffMs / 3_600_000)
}
