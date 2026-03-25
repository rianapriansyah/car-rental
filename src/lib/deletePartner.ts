import { supabase } from './supabase'

export type DeletePartnerResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Deletes a partner record and, if they have a linked auth account, removes that
 * account via the Edge Function `delete-partner` (requires service_role).
 *
 * Partners without an auth account are deleted directly — no Edge Function needed.
 * Deploy the function only when you need to delete linked partners:
 *   `supabase functions deploy delete-partner`
 */
export async function deletePartner(
  partnerId: string,
  authUserId: string | null,
): Promise<DeletePartnerResult> {
  // Remove the auth user first (requires Edge Function with service_role key).
  if (authUserId) {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'delete-partner',
      { body: { authUserId } },
    )
    if (error) {
      return { ok: false, message: error.message }
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { ok: false, message: String(data.error) }
    }
  }

  // Delete the partner row directly — works without any Edge Function.
  const { error: dbError } = await supabase.from('v2_partners').delete().eq('id', partnerId)
  if (dbError) {
    return { ok: false, message: dbError.message }
  }

  return { ok: true }
}
