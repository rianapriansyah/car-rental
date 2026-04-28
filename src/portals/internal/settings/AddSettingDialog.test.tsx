import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const insert = vi.fn(
  (..._args: unknown[]) =>
    Promise.resolve({ error: null as { message: string } | null }),
)
const from = vi.fn((..._args: unknown[]) => ({ insert }))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}))

import { AddSettingDialog } from './AddSettingDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof AddSettingDialog>> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const onError = vi.fn()
  const utils = render(
    <AddSettingDialog
      open
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
      {...overrides}
    />,
  )
  const dialog = screen.getByRole('dialog')
  return { ...utils, onClose, onSaved, onError, dialog }
}

const keyOf = (dialog: HTMLElement) =>
  within(dialog).getByLabelText(/^Kunci/) as HTMLInputElement
const valOf = (dialog: HTMLElement) =>
  within(dialog).getByLabelText(/^Nilai\b(?!\s*lama)/) as HTMLInputElement

describe('AddSettingDialog', () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null })
    from.mockClear()
  })

  it('rejects an empty key via onError', () => {
    const { dialog, onError } = renderDialog()
    fireEvent.change(valOf(dialog), { target: { value: 'whatever' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(onError).toHaveBeenCalledWith(
      'Kunci wajib diisi (huruf kecil, angka, dan garis bawah saja).',
    )
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects keys with disallowed characters', () => {
    const { dialog, onError } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'BadKey-1' } })
    fireEvent.change(valOf(dialog), { target: { value: 'x' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(onError).toHaveBeenCalledWith(
      'Kunci wajib diisi (huruf kecil, angka, dan garis bawah saja).',
    )
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects an empty value via onError', () => {
    const { dialog, onError } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'company_name' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(onError).toHaveBeenCalledWith('Nilai wajib diisi.')
    expect(from).not.toHaveBeenCalled()
  })

  it('normalises the key (lowercase + spaces -> underscores)', async () => {
    const { dialog, onSaved } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: '  Company Name  ' } })
    fireEvent.change(valOf(dialog), { target: { value: 'Acme' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith({
      key: 'company_name',
      value: 'Acme',
      description: null,
    })
  })

  it('strips non-digits from the value when the key is numeric', async () => {
    const { dialog, onSaved } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'overtime_hourly_rate' } })
    fireEvent.change(valOf(dialog), { target: { value: 'Rp 25.000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith({
      key: 'overtime_hourly_rate',
      value: '25000',
      description: null,
    })
  })

  it('rejects a numeric value that has no digits at all', () => {
    const { dialog, onError } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'overtime_hourly_rate' } })
    fireEvent.change(valOf(dialog), { target: { value: 'abc' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(onError).toHaveBeenLastCalledWith('Nilai angka tidak valid.')
  })

  it('forwards supabase insert errors via onError', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'duplicate' } })
    const { dialog, onSaved, onClose, onError } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'company_name' } })
    fireEvent.change(valOf(dialog), { target: { value: 'Acme' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('duplicate'))
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clears form fields when reopened', async () => {
    const { rerender, dialog } = renderDialog()
    fireEvent.change(keyOf(dialog), { target: { value: 'foo' } })
    fireEvent.change(valOf(dialog), { target: { value: 'bar' } })

    rerender(
      <AddSettingDialog open={false} onClose={() => {}} onSaved={() => {}} onError={() => {}} />,
    )
    rerender(<AddSettingDialog open onClose={() => {}} onSaved={() => {}} onError={() => {}} />)
    const reopened = screen.getByRole('dialog')
    expect(keyOf(reopened).value).toBe('')
    expect(valOf(reopened).value).toBe('')
  })
})
