import { supabase } from './supabase'

export type InvitePartnerResult =
  | { ok: true; userId: string }
  | { ok: false; message: string }

/**
 * Invites a partner via Supabase Edge Function (service role + admin.inviteUserByEmail).
 * Deploy `supabase/functions/invite-partner` and set secrets before using in production.
 */
export async function invitePartnerByEmail(email: string): Promise<InvitePartnerResult> {
  const { data, error } = await supabase.functions.invoke<{ userId?: string; error?: string }>(
    'invite-partner',
    { body: { email } },
  )

  if (error) {
    return { ok: false, message: error.message }
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, message: String(data.error) }
  }

  if (data && typeof data === 'object' && data.userId) {
    return { ok: true, userId: data.userId }
  }

  return { ok: false, message: 'Unexpected response from invite-partner function' }
}
