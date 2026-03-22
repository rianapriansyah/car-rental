import type { Tables } from './database'

export type CarRow = Tables<'v2_cars'>

export type OwnershipType = 'rental' | 'partner'
export type CarStatus = 'available' | 'rented'

export type CarWithPartner = CarRow & {
  v2_partners: { name: string } | null
}
