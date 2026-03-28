import { supabase } from './supabase'

export type RenterInfoPick = {
  id: string
  name: string
  phone: string | null
  status: string
}

/** Matches live app: blocked renters use status `blacklisted`. */
export const RENTER_BLACKLIST_STATUS = 'blacklisted'

export async function searchRenterInfo(query: string): Promise<RenterInfoPick[]> {
  const raw = query.trim()
  if (raw.length < 1) return []

  const pattern = `%${raw}%`
  const [{ data: byName, error: e1 }, { data: byPhone, error: e2 }] = await Promise.all([
    supabase.from('v2_renter_info').select('id, name, phone, status').ilike('name', pattern).limit(20),
    supabase.from('v2_renter_info').select('id, name, phone, status').ilike('phone', pattern).limit(20),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)

  const map = new Map<string, RenterInfoPick>()
  for (const row of [...(byName ?? []), ...(byPhone ?? [])]) {
    map.set(row.id, row as RenterInfoPick)
  }
  return [...map.values()].slice(0, 25)
}

/**
 * Before inserting v2_orders / v2_rentals: ensure a row exists when phone is new.
 * If phone is empty, inserts with null phone (no duplicate check by name).
 */
export async function ensureRenterInInfo(
  name: string,
  phone: string | null,
): Promise<{ error: Error | null }> {
  const n = name.trim()
  if (!n) return { error: new Error('Nama penyewa wajib diisi.') }

  const p = phone?.trim() || null
  if (p) {
    const { data: existing, error: findErr } = await supabase
      .from('v2_renter_info')
      .select('id')
      .eq('phone', p)
      .maybeSingle()
    if (findErr) return { error: new Error(findErr.message) }
    if (existing) return { error: null }
  }

  const { error } = await supabase.from('v2_renter_info').insert({
    name: n,
    phone: p,
    status: 'active',
  })
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function isRenterBlacklisted(name: string, phone: string | null): Promise<boolean> {
  const n = name.trim()
  const p = phone?.trim() || null
  if (p) {
    const { data } = await supabase
      .from('v2_renter_info')
      .select('status')
      .eq('phone', p)
      .maybeSingle()
    if (data?.status === RENTER_BLACKLIST_STATUS) return true
  }
  if (n) {
    const { data: rows } = await supabase
      .from('v2_renter_info')
      .select('status')
      .ilike('name', n)
      .eq('status', RENTER_BLACKLIST_STATUS)
      .limit(1)
    if (rows && rows.length > 0) return true
  }
  return false
}
