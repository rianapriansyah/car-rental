import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertDownPaymentIncomeTransaction } from './rentalDownPaymentTxn'

function mockSupabase(opts?: {
  ledgerActive?: boolean
  carMissing?: boolean
  carErr?: { message: string }
}) {
  const ledgerActive = opts?.ledgerActive ?? true
  const insert = vi.fn(() => Promise.resolve({ error: null }))
  const from = vi.fn((table: string) => {
    if (table === 'v2_cars') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts?.carMissing ? null : { ledger_active: ledgerActive },
                error: opts?.carErr ?? null,
              }),
          }),
        }),
      }
    }
    return { insert }
  })
  return { from, insert }
}

describe('insertDownPaymentIncomeTransaction', () => {
  it('does not insert when amount is zero', async () => {
    const { from, insert } = mockSupabase()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 0)
    expect(error).toBeNull()
    expect(from).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not insert when amount is negative', async () => {
    const { from, insert } = mockSupabase()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', -100)
    expect(error).toBeNull()
    expect(from).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('inserts dp_rental_income with expected payload', async () => {
    const { from, insert } = mockSupabase()
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 250_000)
    expect(error).toBeNull()
    expect(from).toHaveBeenCalledWith('v2_cars')
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

  it('skips insert when car has ledger_active false', async () => {
    const { from, insert } = mockSupabase({ ledgerActive: false })
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 50_000)
    expect(error).toBeNull()
    expect(from).toHaveBeenCalledWith('v2_cars')
    expect(from).not.toHaveBeenCalledWith('v2_transactions')
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns error when car row is missing', async () => {
    const { from, insert } = mockSupabase({ carMissing: true })
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-x', 'rent-1', 1)
    expect(error?.message).toBe('Car not found')
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns error when car lookup fails', async () => {
    const { from } = mockSupabase({ carErr: { message: 'denied' } })
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'car-1', 'rent-1', 1)
    expect(error?.message).toBe('denied')
  })

  it('returns error when insert fails', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: { message: 'rls' } }))
    const from = vi.fn((table: string) => {
      if (table === 'v2_cars') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { ledger_active: true }, error: null }),
            }),
          }),
        }
      }
      return { insert }
    })
    const supabase = { from } as unknown as SupabaseClient
    const { error } = await insertDownPaymentIncomeTransaction(supabase, 'c', 'r', 1)
    expect(error?.message).toBe('rls')
  })
})
