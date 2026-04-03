import type { SupabaseClient } from '@supabase/supabase-js'

/** Ledger income when down payment is collected at check-in (order path uses DB activate_order). */
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
