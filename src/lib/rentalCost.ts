/**
 * Reference checkout pricing: first 25h = 1× daily, then each 24h segment uses
 * ≤12h → OT (hours ceiled per segment); >12h → one full daily.
 */

export type CostBreakdown = {
  elapsedHours: number
  fullDays: number
  overtimeHours: number
  dailyCost: number
  overtimeCost: number
  total: number
}

export const SEGMENT_FULL_DAY_THRESHOLD_H = 12

export function calcCost(
  elapsedHours: number,
  dailyRate: number,
  overtimeRate: number,
): CostBreakdown {
  let fullDays = 1
  let overtimeHours = 0
  if (elapsedHours > 25) {
    let t = elapsedHours - 25
    while (t > 1e-6) {
      const segment = Math.min(t, 24)
      if (segment > SEGMENT_FULL_DAY_THRESHOLD_H) {
        fullDays += 1
      } else {
        overtimeHours += Math.ceil(segment)
      }
      t -= segment
    }
  }
  const dailyCost = fullDays * dailyRate
  const overtimeCost = overtimeHours * overtimeRate
  return { elapsedHours, fullDays, overtimeHours, dailyCost, overtimeCost, total: dailyCost + overtimeCost }
}
