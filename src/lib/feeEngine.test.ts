import { describe, expect, it, vi, beforeEach } from 'vitest'

const updatePayloads: Record<string, unknown>[] = []

const { rpc, from } = vi.hoisted(() => {
  const rpc = vi.fn()
  const from = vi.fn()
  return { rpc, from }
})

vi.mock('./supabase', () => ({
  supabase: {
    from,
    rpc,
  },
}))

import { completeRentalWithIncome } from './feeEngine'

describe('completeRentalWithIncome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updatePayloads.length = 0
    rpc.mockResolvedValue({ error: null })
    from.mockImplementation(() => {
      const eq = vi.fn(() => Promise.resolve({ error: null }))
      const update = vi.fn((patch: Record<string, unknown>) => {
        updatePayloads.push(patch)
        return { eq }
      })
      return { update }
    })
  })

  it('updates rental gross_income then calls complete_rental RPC', async () => {
    const { error } = await completeRentalWithIncome('rent-1', 1_200_000, 'note', {
      endDate: '2026-04-10',
      endTime: '14:30',
    })
    expect(error).toBeNull()
    expect(updatePayloads[0]).toMatchObject({
      gross_income: 1_200_000,
      manual_note: 'note',
      end_date: '2026-04-10',
      end_time: '14:30',
    })
    expect(rpc).toHaveBeenCalledWith('complete_rental', { p_rental_id: 'rent-1' })
  })

  it('writes full gross_income (DP + checkout) for DB fee and completion split', async () => {
    await completeRentalWithIncome('r2', 900_000)
    expect(updatePayloads[0]).toMatchObject({ gross_income: 900_000 })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('re-applies end_date after RPC when completionAt provided', async () => {
    await completeRentalWithIncome('r1', 800_000, undefined, {
      endDate: '2026-05-01',
      endTime: '09:00',
    })
    const rentalPatches = updatePayloads.filter(
      (p) => 'gross_income' in p || ('end_date' in p && !('gross_income' in p)),
    )
    const finalPatch = rentalPatches.at(-1)
    expect(finalPatch).toEqual({ end_date: '2026-05-01', end_time: '09:00' })
  })

  it('returns error when first rental update fails', async () => {
    from.mockImplementationOnce(() => {
      const eq = vi.fn(() => Promise.resolve({ error: { message: 'fail' } }))
      const update = vi.fn(() => ({ eq }))
      return { update }
    })
    const { error } = await completeRentalWithIncome('r1', 100)
    expect(error?.message).toBe('fail')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns error when RPC fails', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'rpc down' } })
    const { error } = await completeRentalWithIncome('r1', 100)
    expect(error?.message).toBe('rpc down')
  })

  it('updates v2_cars mileage when options include carId and mileageKm', async () => {
    const { error } = await completeRentalWithIncome('rent-1', 1_200_000, undefined, undefined, {
      carId: 'car-99',
      mileageKm: 45_231,
    })
    expect(error).toBeNull()
    expect(from).toHaveBeenCalledWith('v2_cars')
    expect(updatePayloads.some((p) => p && typeof p === 'object' && 'mileage' in p && (p as { mileage: number }).mileage === 45_231)).toBe(true)
  })
})
