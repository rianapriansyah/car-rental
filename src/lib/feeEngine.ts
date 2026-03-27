import { supabase } from './supabase'

type CompletionAt = {
  endDate: string
  endTime: string
}

/**
 * Persists gross income and finalizes the rental via DB RPC (fees are never computed in the client).
 */
export async function completeRentalWithIncome(
  rentalId: string,
  grossIncome: number,
  combinedNote?: string,
  completionAt?: CompletionAt,
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = { gross_income: grossIncome }
  if (combinedNote !== undefined) patch.manual_note = combinedNote || null
  if (completionAt) {
    patch.end_date = completionAt.endDate
    patch.end_time = completionAt.endTime
  }

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

  // Ensure custom completion timestamp remains persisted even if RPC applies NOW() defaults.
  if (completionAt) {
    const { error: finalUpdateError } = await supabase
      .from('v2_rentals')
      .update({
        end_date: completionAt.endDate,
        end_time: completionAt.endTime,
      })
      .eq('id', rentalId)

    if (finalUpdateError) {
      return { error: new Error(finalUpdateError.message) }
    }
  }

  return { error: null }
}
