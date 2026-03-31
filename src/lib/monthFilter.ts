export type MonthFilterOption = {
  value: string
  label: string
}

export function buildCurrentYearMonthOptions(now = new Date()): MonthFilterOption[] {
  const year = now.getFullYear()
  const endMonthIndex = now.getMonth()
  const out: MonthFilterOption[] = []
  for (let m = 0; m <= endMonthIndex; m += 1) {
    const value = `${year}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(year, m, 1).toLocaleString('id-ID', {
      month: 'long',
      year: 'numeric',
    })
    out.push({ value, label })
  }
  return out
}

