import type { User } from '@supabase/supabase-js'

export function isAdminUser(user: User | null | undefined): boolean {
  const role = user?.app_metadata && typeof user.app_metadata === 'object' && 'role' in user.app_metadata
    ? (user.app_metadata as { role?: unknown }).role
    : undefined
  return role === 'admin'
}
