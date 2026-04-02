import type { ServiceCategory, ServiceType } from '../types/service'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  ban: 'Ban',
  aki: 'Aki',
  kampas_rem: 'Kampas Rem',
  cakram_rem: 'Cakram Rem',
  timing_belt: 'Timing Belt',
  v_belt: 'V-Belt',
  filter_udara: 'Filter Udara',
  filter_bbm: 'Filter BBM',
  filter_kabin: 'Filter Kabin',
  busi: 'Busi',
  part_lainnya: 'Part Lainnya',
  ganti_oli_mesin: 'Ganti Oli Mesin',
  ganti_oli_transmisi: 'Ganti Oli Transmisi',
  ganti_coolant: 'Ganti Coolant',
  ganti_minyak_rem: 'Ganti Minyak Rem',
  perawatan_lainnya: 'Perawatan Lainnya',
}

export const SERVICE_TYPES_BY_CATEGORY: Record<ServiceCategory, ServiceType[]> = {
  component_replacement: [
    'ban',
    'aki',
    'kampas_rem',
    'cakram_rem',
    'timing_belt',
    'v_belt',
    'filter_udara',
    'filter_bbm',
    'filter_kabin',
    'busi',
    'part_lainnya',
  ],
  routine_maintenance: [
    'ganti_oli_mesin',
    'ganti_oli_transmisi',
    'ganti_coolant',
    'ganti_minyak_rem',
    'perawatan_lainnya',
  ],
}
