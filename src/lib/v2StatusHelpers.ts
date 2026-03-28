import type { ChipProps } from '@mui/material'
import { supabase } from './supabase'

export type V2StatusRow = {
  id: string
  type: string
  label: string
  color: string
  description: string | null
}

/** Maps v2_statuses.color (DB) to MUI Chip color — never use raw strings in UI chips. */
export function muiChipColorFromV2Color(dbColor: string): ChipProps['color'] {
  const c = dbColor.toLowerCase().trim()
  if (c === 'green') return 'success'
  if (c === 'amber') return 'warning'
  if (c === 'blue') return 'info'
  if (c === 'red') return 'error'
  if (c === 'gray' || c === 'grey') return 'default'
  return 'default'
}

export async function fetchV2StatusesByType(type: 'car' | 'order'): Promise<Map<string, V2StatusRow>> {
  const { data, error } = await supabase
    .from('v2_statuses')
    .select('id, type, label, color, description')
    .eq('type', type)

  if (error) throw new Error(error.message)
  const map = new Map<string, V2StatusRow>()
  for (const row of data ?? []) {
    map.set(row.id, row as V2StatusRow)
  }
  return map
}
