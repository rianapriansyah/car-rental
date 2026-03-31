import { describe, expect, it } from 'vitest'
import { buildCurrentYearMonthOptions } from './monthFilter'

describe('buildCurrentYearMonthOptions', () => {
  it('builds month list from January up to current month', () => {
    const options = buildCurrentYearMonthOptions(new Date('2026-03-15T10:00:00.000Z'))
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.value)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('always starts from January of same year', () => {
    const options = buildCurrentYearMonthOptions(new Date('2026-01-01T00:00:00.000Z'))
    expect(options).toHaveLength(1)
    expect(options[0]?.value).toBe('2026-01')
  })
})

