import type { TransactionRow } from '../types/transaction'

/**
 * Management fee for a partner-owned car for a set of transactions (e.g. one month),
 * aligned with {@link TransactionsPage}: prefers recorded rental_fee rows, else % of (income − ops expenses).
 */
export function computePartnerRentalFeeForTransactions(
  transactions: TransactionRow[],
  feePct: number,
): number {
  let totalIncome = 0
  let totalExpenseOps = 0
  let totalRentalFee = 0
  for (const t of transactions) {
    const amt = Number(t.amount)
    if (t.type === 'income') totalIncome += amt
    else if (t.category === 'rental_fee' || t.category === 'partner_fee') totalRentalFee += amt
    else totalExpenseOps += amt
  }
  return totalRentalFee > 0
    ? totalRentalFee
    : Math.round(((totalIncome - totalExpenseOps) * feePct) / 100)
}
