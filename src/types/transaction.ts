import type { Tables } from './database'

export type TransactionRow = Tables<'v2_transactions'>

export type TransactionType = 'income' | 'expense'

export type TransactionCategory =
  | 'rental_income'
  | 'gps_topup'
  | 'maintenance'
  | 'partner_fee'
  | 'owner_withdrawal'
  | 'other'
