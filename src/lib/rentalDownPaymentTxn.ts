import type { SupabaseClient } from '@supabase/supabase-js'

/** Ledger income for rental DP (check-in, order activation, or additional DP on an active rental). */
export async function insertDownPaymentIncomeTransaction(
  supabase: SupabaseClient,
  carId: string,
  rentalId: string,
  amount: number,
): Promise<{ error: Error | null }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: null }
  }
  const { error } = await supabase.from('v2_transactions').insert({
    car_id: carId,
    rental_id: rentalId,
    type: 'income',
    category: 'dp_rental_income',
    amount,
    auto_fee: false,
  })
  return { error: error ? new Error(error.message) : null }
}
