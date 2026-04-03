import { describe, expect, it } from 'vitest'
import { checkoutRentalIncomeAmount } from './rentalIncomeSplit'

describe('checkoutRentalIncomeAmount', () => {
  it('is gross minus down payment when remainder positive', () => {
    expect(checkoutRentalIncomeAmount(1_000_000, 250_000)).toBe(750_000)
  })

  it('is zero when fully covered by DP', () => {
    expect(checkoutRentalIncomeAmount(800_000, 800_000)).toBe(0)
  })

  it('is zero when DP exceeds gross (bad data clamped)', () => {
    expect(checkoutRentalIncomeAmount(500_000, 600_000)).toBe(0)
  })

  it('treats non-finite gross as 0', () => {
    expect(checkoutRentalIncomeAmount(Number.NaN, 100)).toBe(0)
  })

  it('treats non-finite DP as 0', () => {
    expect(checkoutRentalIncomeAmount(400_000, Number.NaN)).toBe(400_000)
  })
})
