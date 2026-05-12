/**
 * Public URL used on kuitansi QR codes. Set in production, e.g. `https://rental.example.com`.
 * Falls back to the current browser origin in dev when unset (same host as the SPA).
 */
export function getPublicSiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** Full URL to the read-only verification page for a completed rental. */
export function buildRentalVerificationUrl(rentalId: string): string {
  const base = getPublicSiteBaseUrl()
  const id = rentalId.trim()
  if (!base || !id) return ''
  return `${base}/verify/${encodeURIComponent(id)}`
}
