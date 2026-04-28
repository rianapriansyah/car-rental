import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const eq = vi.fn(
  (..._args: unknown[]) =>
    Promise.resolve({ error: null as { message: string } | null }),
)
const update = vi.fn((..._args: unknown[]) => ({ eq }))
const from = vi.fn((..._args: unknown[]) => ({ update }))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

import { OrderCancelDialog } from './OrderCancelDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof OrderCancelDialog>> = {}) {
  const onClose = vi.fn()
  const onCancelled = vi.fn()
  const onError = vi.fn()
  const utils = render(
    <OrderCancelDialog
      open
      orderId="order-1"
      onClose={onClose}
      onCancelled={onCancelled}
      onError={onError}
      {...overrides}
    />,
  )
  const dialog = screen.getByRole('dialog')
  return { ...utils, onClose, onCancelled, onError, dialog }
}

function getReason(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(/Alasan pembatalan/i) as HTMLInputElement
}

describe('OrderCancelDialog', () => {
  beforeEach(() => {
    eq.mockReset().mockResolvedValue({ error: null })
    update.mockClear()
    from.mockClear()
  })

  it('does not render when closed', () => {
    render(
      <OrderCancelDialog
        open={false}
        orderId="x"
        onClose={() => {}}
        onCancelled={() => {}}
        onError={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reports an error and skips supabase when reason is blank', () => {
    const { dialog, onError, onCancelled } = renderDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pembatalan' }))
    expect(onError).toHaveBeenCalledWith('Alasan pembatalan wajib diisi.')
    expect(from).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('updates the order with the trimmed reason and calls onCancelled + onClose on success', async () => {
    const { dialog, onCancelled, onClose, onError } = renderDialog()
    fireEvent.change(getReason(dialog), { target: { value: '   penyewa membatalkan  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pembatalan' }))

    await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1))
    expect(from).toHaveBeenCalledWith('v2_orders')
    const firstCall = update.mock.calls[0] as [Record<string, unknown>] | undefined
    expect(firstCall).toBeDefined()
    const payload = firstCall![0]
    expect(payload).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'penyewa membatalkan',
    })
    expect(typeof payload.cancelled_at).toBe('string')
    expect(eq).toHaveBeenCalledWith('id', 'order-1')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('forwards supabase update errors via onError and stays open', async () => {
    eq.mockResolvedValueOnce({ error: { message: 'rls denied' } })
    const { dialog, onCancelled, onClose, onError } = renderDialog()
    fireEvent.change(getReason(dialog), { target: { value: 'alasan' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pembatalan' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('rls denied'))
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does nothing when orderId is null', () => {
    const { dialog, onCancelled, onError } = renderDialog({ orderId: null })
    fireEvent.change(getReason(dialog), { target: { value: 'alasan' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pembatalan' }))
    expect(from).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('clicking "Tutup" calls onClose', () => {
    const { dialog, onClose } = renderDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tutup' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets the reason when reopened', async () => {
    const { rerender, dialog } = renderDialog()
    fireEvent.change(getReason(dialog), { target: { value: 'isi' } })

    rerender(
      <OrderCancelDialog
        open={false}
        orderId="order-1"
        onClose={() => {}}
        onCancelled={() => {}}
        onError={() => {}}
      />,
    )
    rerender(
      <OrderCancelDialog
        open
        orderId="order-1"
        onClose={() => {}}
        onCancelled={() => {}}
        onError={() => {}}
      />,
    )
    const reopened = screen.getByRole('dialog')
    expect(getReason(reopened).value).toBe('')
  })
})
