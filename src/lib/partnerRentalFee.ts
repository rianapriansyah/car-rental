import type { TransactionRow } from '../types/transaction'

/** Sum of all income amounts in a transaction set (e.g. one month for one car). */
export function sumMonthIncomeFromTransactions(transactions: TransactionRow[]): number {
  let total = 0
  for (const t of transactions) {
    if (t.type === 'income') total += Number(t.amount)
  }
  return total
}

/**
 * Sum of operational expenses excluding partner fee lines (GPS, maintenance, etc.).
 * Aligns with {@link sumRecordedRentalFeeFromTransactions} for net partner math.
 */
export function sumOpsExpenseExcludingRentalFee(transactions: TransactionRow[]): number {
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.category === 'rental_fee' || t.category === 'partner_fee') continue
    total += Number(t.amount)
  }
  return total
}

/**
 * Sum of recorded partner/management fee expenses for a set of transactions (e.g. one month).
 * Single source of truth: only `rental_fee` / legacy `partner_fee` rows in `v2_transactions`.
 */
export function sumRecordedRentalFeeFromTransactions(transactions: TransactionRow[]): number {
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.category === 'rental_fee' || t.category === 'partner_fee') {
      total += Number(t.amount)
    }
  }
  return total
}
