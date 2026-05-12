import { describe, expect, it } from 'vitest'
import { buildReceiptLineItems } from './rentalReceiptFormat'
import type { RentalWithCar } from '../../../types/rental'

function baseRental(partial: Partial<RentalWithCar>): RentalWithCar {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    car_id: '00000000-0000-4000-8000-000000000002',
    renter_name: 'Test',
    renter_phone: null,
    start_date: '2026-05-10',
    start_time: '07:00',
    end_date: '2026-05-13',
    end_time: '07:00',
    duration_days: null,
    down_payment: 0,
    gross_income: 1_500_000,
    driver_fee: 450_000,
    status: 'completed',
    is_manual: false,
    include_driver: true,
    manual_note: null,
    created_at: null,
    v2_cars: { name: 'Xenia', plate: 'B 1 TEST', daily_rate: 350_000 },
    ...partial,
  }
}

describe('buildReceiptLineItems', () => {
  it('produces Sewa Mobil and Jasa Driver rows aligned with tariff example', () => {
    const rows = buildReceiptLineItems(baseRental({}))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      item: 'Sewa Mobil',
      durasi: '3 hari',
      tarifHarian: expect.stringContaining('350'),
      total: expect.stringContaining('1.050.000'),
    })
    expect(rows[1]).toMatchObject({
      item: 'Jasa Driver',
      durasi: '3 hari',
      tarifHarian: expect.stringContaining('150'),
      total: expect.stringContaining('450.000'),
    })
  })
})
