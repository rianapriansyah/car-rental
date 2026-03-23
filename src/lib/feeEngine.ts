import { supabase } from './supabase'

/**
 * Persists gross income and finalizes the rental via DB RPC (fees are never computed in the client).
 */
export async function completeRentalWithIncome(
  rentalId: string,
  grossIncome: number,
  combinedNote?: string,
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = { gross_income: grossIncome }
  if (combinedNote !== undefined) patch.manual_note = combinedNote || null

  const { error: updateError } = await supabase
    .from('v2_rentals')
    .update(patch)
    .eq('id', rentalId)

  if (updateError) {
    return { error: new Error(updateError.message) }
  }

  const { error: rpcError } = await supabase.rpc('complete_rental', {
    p_rental_id: rentalId,
  })

  if (rpcError) {
    return { error: new Error(rpcError.message) }
  }

  return { error: null }
}
