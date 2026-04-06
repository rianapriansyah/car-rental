import type { ChipProps } from '@mui/material'

/** Shared layout for status chips in tables and cards. */
export const statusChipSx: ChipProps['sx'] = { my: 0.5 }

const CAR_LABELS_ID: Record<string, string> = {
  available: 'Tersedia',
  rented: 'Disewa',
  inactive: 'Tidak aktif',
}

const CAR_LABELS_EN: Record<string, string> = {
  available: 'Available',
  rented: 'Rented',
  inactive: 'Inactive',
}

/**
 * Fleet car lifecycle: available → rented → available; inactive = out of fleet.
 */
export function getCarStatusChipProps(
  status: string,
  locale: 'id' | 'en' = 'id',
): { label: string; color: ChipProps['color'] } {
  const s = status.toLowerCase().trim()
  const labels = locale === 'en' ? CAR_LABELS_EN : CAR_LABELS_ID
  if (s === 'available') return { label: labels.available, color: 'success' }
  if (s === 'rented') return { label: labels.rented, color: 'warning' }
  if (s === 'inactive') return { label: labels.inactive, color: 'error' }
  return { label: status, color: 'default' }
}

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

/**
 * Rental lifecycle chips: ongoing (info), done (success), cancelled (neutral).
 */
export function getRentalStatusChipProps(status: string): { label: string; color: ChipProps['color'] } {
  const s = status.toLowerCase().trim()
  const label = RENTAL_STATUS_LABELS[s] ?? status
  if (s === 'active') return { label, color: 'info' }
  if (s === 'completed') return { label, color: 'success' }
  if (s === 'cancelled') return { label, color: 'default' }
  return { label, color: 'default' }
}

export function getRenterAccountChipProps(status: string): { label: string; color: ChipProps['color'] } {
  const s = status.toLowerCase().trim()
  if (s === 'blacklisted') return { label: 'Diblokir', color: 'error' }
  return { label: 'Aktif', color: 'success' }
}
