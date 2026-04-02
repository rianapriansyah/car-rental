import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { calcOrderDurationDays } from './orderDuration'

describe('calcOrderDurationDays', () => {
  it('counts elapsed 24h blocks from start_time', () => {
    const days = calcOrderDurationDays(
      dayjs('2026-04-01'),
      dayjs('2026-04-05'),
      '08:00',
    )
    expect(days).toBe(4)
  })

  it('returns minimum 1 day for same date', () => {
    const days = calcOrderDurationDays(
      dayjs('2026-04-01'),
      dayjs('2026-04-01'),
      '08:00',
    )
    expect(days).toBe(1)
  })

  it('handles malformed time safely', () => {
    const days = calcOrderDurationDays(
      dayjs('2026-04-01'),
      dayjs('2026-04-02'),
      'xx:yy',
    )
    expect(days).toBe(1)
  })
})

