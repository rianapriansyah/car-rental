import { supabase } from './supabase'
import { getPartnerInviteRedirectUrl } from './partnerInviteRedirect'

export type InvitePartnerResult =
  | { ok: true; userId: string }
  | { ok: false; message: string }

export type InvitePartnerOptions = {
  /** Override redirect after invite email (default: current app origin + `/partner/accept-invite`). */
  redirectTo?: string
}

/**
 * Invites a partner via Edge Function `invite-partner` (admin JWT + service_role inviteUserByEmail).
 * Deploy: `supabase functions deploy invite-partner`
 * Add `https://<your-app>/partner/accept-invite` (and localhost for dev) under Auth → URL configuration.
 */
export async function invitePartnerByEmail(
  email: string,
  options?: InvitePartnerOptions,
): Promise<InvitePartnerResult> {
  const redirectTo = options?.redirectTo ?? getPartnerInviteRedirectUrl()

  const { data, error } = await supabase.functions.invoke<{ userId?: string; error?: string }>(
    'invite-partner',
    { body: { email: email.trim(), redirectTo } },
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

  return { ok: false, message: 'Respons tidak valid dari fungsi invite-partner.' }
}
