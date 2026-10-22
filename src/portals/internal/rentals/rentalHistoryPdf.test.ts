import { describe, expect, it } from 'vitest'
import { formatRentalDateTime, monthLabelId } from './rentalHistoryPdf'

describe('monthLabelId', () => {
  it('renders the Indonesian month name and year', () => {
    expect(monthLabelId('2026-10')).toBe('Oktober 2026')
    expect(monthLabelId('2026-01')).toBe('Januari 2026')
    expect(monthLabelId('2026-12')).toBe('Desember 2026')
  })

  it('falls back to the raw value when it is not a month key', () => {
    expect(monthLabelId('2026-13')).toBe('2026-13')
    expect(monthLabelId('2026-00')).toBe('2026-00')
    expect(monthLabelId('')).toBe('')
  })
})

describe('formatRentalDateTime', () => {
  it('renders day-first date with HH:mm', () => {
    expect(formatRentalDateTime('2026-10-20', '08:00:00')).toBe('20-10-2026 08:00')
    expect(formatRentalDateTime('2026-10-20', '08:00')).toBe('20-10-2026 08:00')
  })

  it('omits the time when there is none recorded', () => {
    expect(formatRentalDateTime('2026-10-20', null)).toBe('20-10-2026')
    expect(formatRentalDateTime('2026-10-20', '  ')).toBe('20-10-2026')
  })

  it('shows a dash for a rental that has not ended', () => {
    expect(formatRentalDateTime(null, null)).toBe('—')
  })
})
