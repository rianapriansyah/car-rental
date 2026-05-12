import { describe, expect, it } from 'vitest'
import { calcDriverFeeVariantA } from './driverFee'

describe('calcDriverFeeVariantA', () => {
  it('returns 0 when not included', () => {
    expect(calcDriverFeeVariantA(100, 300_000, false)).toBe(0)
  })

  it('bills at least one half-day for short elapsed', () => {
    expect(calcDriverFeeVariantA(1, 300_000, true)).toBe(150_000)
  })

  it('uses ceil(h/12) half-day units', () => {
    expect(calcDriverFeeVariantA(13, 300_000, true)).toBe(300_000)
    expect(calcDriverFeeVariantA(25, 300_000, true)).toBe(450_000)
  })
})
