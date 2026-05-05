import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribes to Postgres changes on public `v2_*` tables and calls onRefresh when any event fires.
 * `tablesKey` should be a stable comma-separated list, e.g. `"v2_cars,v2_rentals"`.
 *
 * Requirements per table: enabled on `supabase_realtime` publication, RLS allows SELECT for the
 * client's role (anon JWT on public routes). Avoid commas in the derived channel name — topics use
 * only alphanumeric / `_` / `-`.
 */
export function useV2RealtimeRefresh(tablesKey: string, onRefresh: () => void) {
  useEffect(() => {
    const tables = tablesKey
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (tables.length === 0) return

    const debounceMs = 200
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        onRefresh()
      }, debounceMs)
    }

    const topicSuffix = tables.join('_').replace(/[^a-zA-Z0-9_-]/g, '')
    const channel = supabase.channel(`v2-rt_${topicSuffix}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
    }

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[useV2RealtimeRefresh]', tablesKey, status, err)
      }
    })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [tablesKey, onRefresh])
}
