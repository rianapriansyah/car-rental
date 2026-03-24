/** URL partners land on after clicking the email invite link (must be in Supabase Auth redirect URLs). */
export function getPartnerInviteRedirectUrl(): string {
  const base =
    import.meta.env.VITE_PARTNER_INVITE_ORIGIN?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/partner/accept-invite`
}
