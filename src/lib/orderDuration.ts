import type { Dayjs } from 'dayjs'

function parseHm(time: string): { hour: number; minute: number } {
  const [hRaw = '0', mRaw = '0'] = time.split(':')
  const hour = Math.min(23, Math.max(0, Number(hRaw)))
  const minute = Math.min(59, Math.max(0, Number(mRaw)))
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

/**
 * Calculates order duration from elapsed time (not inclusive date counting).
 * End datetime is interpreted as end_date at the same start_time clock.
 */
export function calcOrderDurationDays(startDate: Dayjs, endDate: Dayjs, startTime: string): number {
  const { hour, minute } = parseHm(startTime)
  const start = startDate.startOf('day').hour(hour).minute(minute).second(0).millisecond(0)
  const end = endDate.startOf('day').hour(hour).minute(minute).second(0).millisecond(0)
  const elapsedHours = end.diff(start, 'minute') / 60
  return Math.max(1, Math.ceil(elapsedHours / 24))
}

