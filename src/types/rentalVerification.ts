/** Payload from `get_rental_verification_snapshot` RPC (public read, completed rentals only). */
export type RentalVerificationSnapshot = {
  rental_id: string
  renter_name: string
  car_name: string
  car_plate: string
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  amount: number
  receipt_no: string
  company_name: string
  admin_number: string | null
}

export function isRentalVerificationSnapshot(value: unknown): value is RentalVerificationSnapshot {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.rental_id === 'string' &&
    typeof o.renter_name === 'string' &&
    typeof o.car_name === 'string' &&
    typeof o.receipt_no === 'string' &&
    typeof o.company_name === 'string' &&
    typeof o.amount === 'number'
  )
}
