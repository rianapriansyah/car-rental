import type { User } from '@supabase/supabase-js'

export function getAppRole(user: User | null | undefined): string | undefined {
  const role =
    user?.app_metadata && typeof user.app_metadata === 'object' && 'role' in user.app_metadata
      ? (user.app_metadata as { role?: unknown }).role
      : undefined
  return typeof role === 'string' ? role : undefined
}

export function isAdminUser(user: User | null | undefined): boolean {
  return getAppRole(user) === 'admin'
}

/** Internal staff: full internal portal (admin or operator). Not partners. */
export function isInternalStaffUser(user: User | null | undefined): boolean {
  const r = getAppRole(user)
  return r === 'admin' || r === 'operator'
}
