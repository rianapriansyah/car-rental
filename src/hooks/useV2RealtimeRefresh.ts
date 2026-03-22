import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribes to Postgres changes on public `v2_*` tables and calls onRefresh when any event fires.
 * `tablesKey` should be a stable comma-separated list, e.g. `"v2_cars,v2_rentals"`.
 */
export function useV2RealtimeRefresh(tablesKey: string, onRefresh: () => void) {
  useEffect(() => {
    const tables = tablesKey
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (tables.length === 0) return

    const channel = supabase.channel(`v2-rt-${tablesKey}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        onRefresh()
      })
    }
    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tablesKey, onRefresh])
}
