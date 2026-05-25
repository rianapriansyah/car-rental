import { describe, expect, it } from 'vitest'
import { buildOrderConfirmationWhatsAppMessage } from './orderConfirmationWhatsapp'
import type { OrderConfirmationInput } from './orderConfirmationShared'

const baseOrder: OrderConfirmationInput = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  renter_name: 'Rian',
  renter_phone: '081226725373',
  start_date: '2026-05-26',
  start_time: '22:19',
  end_date: null,
  duration_days: null,
  deposit_amount: 300_000,
  deposit_paid: false,
  notes: null,
  v2_cars: { name: 'Mega Carry', plate: 'DN8343KN', daily_rate: 300_000 },
}

describe('buildOrderConfirmationWhatsAppMessage', () => {
  it('includes order proof details and confirmation text', () => {
    const msg = buildOrderConfirmationWhatsAppMessage(baseOrder)
    expect(msg).toContain('Halo Rian,')
    expect(msg).toContain('Mega Carry (DN8343KN)')
    expect(msg).toContain('*No. pesanan*: ORD-')
    expect(msg).toContain('*Mulai*: 26 Mei 2026, 22:19')
    expect(msg).toMatch(/\*Referensi tarif\*: Rp.?300\.000 \/ hari/)
    expect(msg).toMatch(/\*Deposit\*: Rp.?300\.000/)
    expect(msg).toContain('*Deposit lunas*: Tidak')
    expect(msg).toContain('*dikonfirmasi*')
    expect(msg).toContain('Ini adalah bukti pemesanan yang sah.')
    expect(msg).toContain('Tunjukkan bukti ini untuk pengambilan mobil.')
  })

  it('includes duration and end date when present', () => {
    const msg = buildOrderConfirmationWhatsAppMessage({
      ...baseOrder,
      end_date: '2026-05-28',
      duration_days: 2,
      notes: 'Antar bandara',
    })
    expect(msg).toContain('*Selesai*: 28 Mei 2026')
    expect(msg).toContain('*Durasi*: 2 hari')
    expect(msg).toMatch(/\*Referensi tarif\*: Rp.?600\.000 \(2 hari × Rp.?300\.000\)/)
    expect(msg).toContain('*Catatan*: Antar bandara')
  })
})
