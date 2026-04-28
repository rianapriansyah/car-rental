import { formatIdr } from '../../../lib/formatIdr'

export type SettingRow = {
  key: string
  value: string
  description: string | null
}

export function formatSettingValue(key: string, raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n) || raw.trim() === '') return raw
  if (key.endsWith('_pct')) return `${n}%`
  if (key.endsWith('_fee') || key.endsWith('_rate')) return formatIdr(n)
  return raw
}

export function settingSearchBlob(row: SettingRow): string {
  const fmt = formatSettingValue(row.key, row.value)
  return `${row.key} ${row.description ?? ''} ${row.value} ${fmt}`.toLowerCase()
}

export function isNumericSettingKey(key: string): boolean {
  return key.endsWith('_pct') || key.endsWith('_fee') || key.endsWith('_rate')
}
