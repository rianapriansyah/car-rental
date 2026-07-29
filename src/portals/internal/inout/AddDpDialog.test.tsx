import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AddDpDialog } from './AddDpDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof AddDpDialog>> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn(async () => null)
  const utils = render(
    <AddDpDialog
      open
      currentDownPayment={100_000}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  const dialog = screen.getByRole('dialog')
  return { ...utils, onClose, onSubmit, dialog }
}

function getInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(/Jumlah DP tambahan/i) as HTMLInputElement
}

describe('AddDpDialog', () => {
  it('shows current down payment in the description', () => {
    const { dialog } = renderDialog({ currentDownPayment: 250_000 })
    expect(within(dialog).getByText(/DP saat ini:/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Rp\s?250\.000/)).toBeInTheDocument()
  })

  it('disables the submit button when input is empty', () => {
    const { dialog } = renderDialog()
    const submit = within(dialog).getByRole('button', { name: 'Simpan' })
    expect(submit).toBeDisabled()
  })

  it('strips non-digit characters from the input', () => {
    const { dialog } = renderDialog()
    const input = getInput(dialog)
    fireEvent.change(input, { target: { value: 'Rp 50.000' } })
    expect(input.value).toBe('50.000')
  })

  it('rejects amounts ≤ 0 with an inline alert and does not call onSubmit', async () => {
    const { dialog, onSubmit } = renderDialog()
    const input = getInput(dialog)
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(
      await within(dialog).findByText(/Masukkan jumlah DP tambahan lebih dari 0/),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with the parsed amount and closes on success', async () => {
    const { dialog, onSubmit, onClose } = renderDialog()
    fireEvent.change(getInput(dialog), { target: { value: '125000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(125_000))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('shows the error message returned by onSubmit and stays open', async () => {
    const onSubmit = vi.fn(async () => 'rls violation')
    const onClose = vi.fn()
    const { dialog } = renderDialog({ onSubmit, onClose })
    fireEvent.change(getInput(dialog), { target: { value: '50000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('rls violation')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows "Menyimpan…" while onSubmit is pending and disables the input', async () => {
    let resolve!: (value: string | null) => void
    const onSubmit = vi.fn(
      () =>
        new Promise<string | null>((r) => {
          resolve = r
        }),
    )
    const { dialog } = renderDialog({ onSubmit })
    fireEvent.change(getInput(dialog), { target: { value: '50000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByRole('button', { name: 'Menyimpan…' })).toBeDisabled()
    expect(getInput(dialog)).toBeDisabled()
    await act(async () => {
      resolve(null)
    })
  })

  it('submits when Enter is pressed in the input', async () => {
    const { dialog, onSubmit } = renderDialog()
    const input = getInput(dialog)
    fireEvent.change(input, { target: { value: '75000' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(75_000))
  })

  it('resets state when reopened', async () => {
    const { rerender, dialog, onSubmit } = renderDialog({
      onSubmit: vi.fn(async () => 'boom'),
    })
    fireEvent.change(getInput(dialog), { target: { value: '50000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await within(dialog).findByText('boom')

    rerender(
      <AddDpDialog
        open={false}
        currentDownPayment={100_000}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    )
    rerender(
      <AddDpDialog
        open
        currentDownPayment={100_000}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    )
    const reopened = screen.getByRole('dialog')
    expect(getInput(reopened).value).toBe('')
    expect(within(reopened).queryByText('boom')).not.toBeInTheDocument()
  })
})
