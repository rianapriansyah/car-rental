import { supabase } from './supabase'

export type DeletePartnerResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Deletes a partner via Edge Function `delete-partner` (service role):
 * - Sets all linked cars to rental-owned (clears partner_id, ownership_type rental)
 * - Removes linked Supabase Auth user when present
 * - Deletes the v2_partners row
 *
 * Deploy: `supabase functions deploy delete-partner`
 */
export async function deletePartner(partnerId: string): Promise<DeletePartnerResult> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'delete-partner',
    { body: { partnerId } },
  )
  if (error) {
    const body = await (error.context as Response | undefined)?.json?.().catch(() => null) as
      | { error?: string }
      | null
    const msg = body?.error ?? error.message
    return { ok: false, message: msg }
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, message: String(data.error) }
  }
  if (data && typeof data === 'object' && data.ok === true) {
    return { ok: true }
  }
  return { ok: false, message: 'Respons tidak valid dari fungsi delete-partner.' }
}
