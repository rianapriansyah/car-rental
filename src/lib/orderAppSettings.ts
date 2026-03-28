import { supabase } from './supabase'

const KEY = 'order_warning_days'

export async function fetchOrderWarningDays(): Promise<number> {
  const { data, error } = await supabase.from('v2_app_settings').select('value').eq('key', KEY).maybeSingle()
  if (error) throw new Error(error.message)
  const n = Number(data?.value ?? '3')
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3
}
