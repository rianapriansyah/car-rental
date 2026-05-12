/**
 * Variant A: driver billing in half-day increments (12h ceilings), daily rate / 2 per half-day.
 */
export function calcDriverFeeVariantA(
  elapsedHours: number,
  dailyDriverRate: number,
  includeDriver: boolean,
): number {
  if (!includeDriver) return 0
  const rate = Number(dailyDriverRate)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  const h = Math.max(0, Number(elapsedHours))
  const halfDay = rate / 2
  const units = Math.max(1, Math.ceil(h / 12))
  return Math.round(units * halfDay)
}
