import type { Tables } from './database'

export type ServiceCategory = 'component_replacement' | 'routine_maintenance'

export type ServiceType =
  | 'ban'
  | 'aki'
  | 'kampas_rem'
  | 'cakram_rem'
  | 'timing_belt'
  | 'v_belt'
  | 'filter_udara'
  | 'filter_bbm'
  | 'filter_kabin'
  | 'busi'
  | 'part_lainnya'
  | 'ganti_oli_mesin'
  | 'ganti_oli_transmisi'
  | 'ganti_coolant'
  | 'ganti_minyak_rem'
  | 'perawatan_lainnya'

export interface CarService {
  id: string
  car_id: string
  category: ServiceCategory
  service_type: ServiceType
  description?: string
  service_date: string
  next_due_date?: string
  cost?: number
  vendor?: string
  notes?: string
  created_at: string
}

export interface ServiceIntervalDefault {
  service_type: ServiceType
  default_interval_months: number
  warning_days: number
}

export type CarServiceRow = Tables<'v2_car_services'>
export type ServiceIntervalDefaultRow = Tables<'v2_service_interval_defaults'>
