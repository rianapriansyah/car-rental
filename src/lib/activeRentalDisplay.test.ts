import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  calcActiveRentalTotals,
  formatDateTimeId,
  formatElapsedCompact,
  type ActiveRentalPricingInput,
} from './activeRentalDisplay'

function rental(over: Partial<ActiveRentalPricingInput> = {}): ActiveRentalPricingInput {
  return {
    start_date: '2026-10-20',
    start_time: '08:00',
    down_payment: null,
    include_driver: false,
    v2_cars: { daily_rate: 400_000 },
    ...over,
  }
}

describe('formatElapsedCompact', () => {
  it('shows hours and minutes under a day', () => {
    expect(formatElapsedCompact(13.12)).toBe('13j 7m')
  })

  it('prefixes days once past 24h', () => {
    expect(formatElapsedCompact(49.5)).toBe('2h 1j 30m')
  })

  it('always shows a unit for a zero duration', () => {
    expect(formatElapsedCompact(0)).toBe('0j 0m')
  })
})

describe('formatDateTimeId', () => {
  it('renders the Indonesian weekday with date and time', () => {
    expect(formatDateTimeId('2026-10-20', '08:00:00')).toBe('Selasa, 20-10-2026 08:00')
  })

  it('falls back when time or date is missing', () => {
    expect(formatDateTimeId('2026-10-20', null)).toBe('Selasa, 20-10-2026 --:--')
    expect(formatDateTimeId(null, '08:00')).toBe('—')
  })
})

describe('calcActiveRentalTotals', () => {
  const now = dayjs('2026-10-20T18:00:00')

  it('prices the first day as one full daily rate', () => {
    const t = calcActiveRentalTotals(rental(), now, 25_000, 0)
    expect(t.breakdown?.fullDays).toBe(1)
    expect(t.gross).toBe(400_000)
    expect(t.sisa).toBe(400_000)
  })

  it('subtracts the down payment from the outstanding amount', () => {
    const t = calcActiveRentalTotals(rental({ down_payment: 150_000 }), now, 25_000, 0)
    expect(t.dp).toBe(150_000)
    expect(t.sisa).toBe(250_000)
  })

  it('never reports a negative outstanding amount when the DP overshoots', () => {
    const t = calcActiveRentalTotals(rental({ down_payment: 900_000 }), now, 25_000, 0)
    expect(t.sisa).toBe(0)
  })

  it('adds the driver fee when the rental includes a driver', () => {
    const t = calcActiveRentalTotals(rental({ include_driver: true }), now, 25_000, 300_000)
    expect(t.driverFee).toBe(150_000)
    expect(t.gross).toBe(550_000)
  })

  it('still reports elapsed time when the car has no daily rate', () => {
    const t = calcActiveRentalTotals(rental({ v2_cars: { daily_rate: null } }), now, 25_000, 0)
    expect(t.breakdown).toBeNull()
    expect(t.gross).toBe(0)
    expect(t.elapsedHours).toBeCloseTo(10, 5)
  })

  it('does not bill a rental whose start is still in the future', () => {
    const t = calcActiveRentalTotals(rental({ start_date: '2026-10-25' }), now, 25_000, 300_000)
    expect(t.breakdown).toBeNull()
    expect(t.elapsedHours).toBe(0)
    expect(t.driverFee).toBe(0)
  })
})
