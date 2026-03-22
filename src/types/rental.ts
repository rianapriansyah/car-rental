import type { Tables } from './database'

export type RentalRow = Tables<'v2_rentals'>
export type RentalStatus = 'active' | 'completed' | 'cancelled'

export type RentalWithCar = RentalRow & {
  v2_cars: { name: string; plate: string } | null
}
