import type { Tables } from './database'

export type TransactionRow = Tables<'v2_transactions'>

export type TransactionType = 'income' | 'expense'

export type TransactionCategory =
  | 'rental_income'
  | 'gps_topup'
  | 'maintenance'
  | 'rental_fee'
  | 'owner_withdrawal'
  | 'other'

/** Display labels for category values (UI / PDF). */
export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  rental_income: 'Pendapatan sewa',
  gps_topup: 'Isi GPS',
  maintenance: 'Perawatan',
  rental_fee: 'Fee Rental',
  owner_withdrawal: 'Penarikan',
  other: 'Lainnya',
}

/** Legacy DB value before rename; still shown as Fee Rental if present. */
export function transactionCategoryLabel(category: string): string {
  if (category === 'partner_fee') return TRANSACTION_CATEGORY_LABELS.rental_fee
  return TRANSACTION_CATEGORY_LABELS[category as TransactionCategory] ?? category
}
