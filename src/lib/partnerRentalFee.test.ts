import { describe, expect, it } from 'vitest'
import type { TransactionRow } from '../types/transaction'
import {
  sumMonthIncomeFromTransactions,
  sumOpsExpenseExcludingRentalFee,
  sumRecordedRentalFeeFromTransactions,
} from './partnerRentalFee'

function row(partial: Partial<TransactionRow> & Pick<TransactionRow, 'type' | 'category' | 'amount'>): TransactionRow {
  return {
    id: 'x',
    car_id: 'c',
    rental_id: null,
    auto_fee: null,
    manual_note: null,
    recorded_at: null,
    ...partial,
  }
}

describe('sumRecordedRentalFeeFromTransactions', () => {
  it('sums rental_fee and legacy partner_fee expenses', () => {
    const txs: TransactionRow[] = [
      row({ type: 'expense', category: 'rental_fee', amount: 100_000 }),
      row({ type: 'expense', category: 'partner_fee', amount: 50_000 }),
    ]
    expect(sumRecordedRentalFeeFromTransactions(txs)).toBe(150_000)
  })

  it('ignores income and other expense categories', () => {
    const txs: TransactionRow[] = [
      row({ type: 'income', category: 'rental_fee', amount: 999 }),
      row({ type: 'expense', category: 'gps_topup', amount: 20_000 }),
      row({ type: 'income', category: 'dp_rental_income', amount: 600_000 }),
    ]
    expect(sumRecordedRentalFeeFromTransactions(txs)).toBe(0)
  })

  it('returns 0 for empty list', () => {
    expect(sumRecordedRentalFeeFromTransactions([])).toBe(0)
  })
})

describe('sumMonthIncomeFromTransactions', () => {
  it('sums income rows only', () => {
    const txs: TransactionRow[] = [
      row({ type: 'income', category: 'dp_rental_income', amount: 600_000 }),
      row({ type: 'expense', category: 'rental_fee', amount: 100_000 }),
    ]
    expect(sumMonthIncomeFromTransactions(txs)).toBe(600_000)
  })
})

describe('sumOpsExpenseExcludingRentalFee', () => {
  it('sums non-fee expenses', () => {
    const txs: TransactionRow[] = [
      row({ type: 'expense', category: 'gps_topup', amount: 50_000 }),
      row({ type: 'expense', category: 'rental_fee', amount: 75_000 }),
    ]
    expect(sumOpsExpenseExcludingRentalFee(txs)).toBe(50_000)
  })
})
