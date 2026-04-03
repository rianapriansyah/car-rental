import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertDownPaymentIncomeTransaction } from './rentalDownPaymentTxn'

function mockSupabaseInsert() {
  const insert = vi.fn(() => Promise.resolve({ error: null }))
  const from = vi.fn(() => ({ insert }))
  return { from, insert }
}

describe('insertDownPaymentIncomeTransaction', () => {
  it('does not insert when amount is zero', async () => {
    const { from, insert } = mockSupabaseInsert()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 0)
    expect(error).toBeNull()
    expect(from).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not insert when amount is negative', async () => {
    const { from } = mockSupabaseInsert()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', -100)
    expect(error).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('inserts dp_rental_income with expected payload', async () => {
    const { from, insert } = mockSupabaseInsert()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 250_000)
    expect(error).toBeNull()
    expect(from).toHaveBeenCalledWith('v2_transactions')
    expect(insert).toHaveBeenCalledWith({
      car_id: 'car-1',
      rental_id: 'rent-1',
      type: 'income',
      category: 'dp_rental_income',
      amount: 250_000,
      auto_fee: false,
    })
  })

  it('returns error when insert fails', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: { message: 'rls' } }))
    const from = vi.fn(() => ({ insert }))
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'c', 'r', 1)
    expect(error?.message).toBe('rls')
  })
})
