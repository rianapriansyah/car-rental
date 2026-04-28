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

import { EditSettingDialog } from './EditSettingDialog'
import type { SettingRow } from './settingHelpers'

function renderDialog(overrides: Partial<React.ComponentProps<typeof EditSettingDialog>> = {}) {
  const target: SettingRow = {
    key: 'company_name',
    value: 'Acme',
    description: 'shown on PDFs',
  }
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const onError = vi.fn()
  const utils = render(
    <EditSettingDialog
      target={target}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
      {...overrides}
    />,
  )
  const dialog = screen.queryByRole('dialog')
  return { ...utils, target, onClose, onSaved, onError, dialog }
}

function getNewValueInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText('Nilai baru') as HTMLInputElement
}

describe('EditSettingDialog', () => {
  beforeEach(() => {
    eq.mockReset().mockResolvedValue({ error: null })
    update.mockClear()
    from.mockClear()
  })

  it('does not render when target is null', () => {
    const { dialog } = renderDialog({ target: null })
    expect(dialog).toBeNull()
  })

  it('preloads value and description from target', () => {
    const { dialog } = renderDialog()
    expect(dialog).not.toBeNull()
    expect(getNewValueInput(dialog!).value).toBe('Acme')
    expect((within(dialog!).getByLabelText('Deskripsi') as HTMLInputElement).value).toBe(
      'shown on PDFs',
    )
  })

  it('disables Simpan when neither value nor description has changed', () => {
    const { dialog } = renderDialog()
    expect(within(dialog!).getByRole('button', { name: 'Simpan' })).toBeDisabled()
  })

  it('strips non-digits when the key is numeric (ends in _rate)', () => {
    const { dialog } = renderDialog({
      target: { key: 'overtime_hourly_rate', value: '25000', description: null },
    })
    const input = getNewValueInput(dialog!)
    fireEvent.change(input, { target: { value: 'Rp 30.000' } })
    expect(input.value).toBe('30000')
  })

  it('rejects an empty value via onError without calling supabase', () => {
    const { dialog, onError } = renderDialog()
    fireEvent.change(getNewValueInput(dialog!), { target: { value: '   ' } })
    fireEvent.click(within(dialog!).getByRole('button', { name: 'Simpan' }))
    expect(onError).toHaveBeenCalledWith('Nilai tidak boleh kosong.')
    expect(from).not.toHaveBeenCalled()
  })

  it('updates supabase and calls onSaved + onClose on success', async () => {
    const { dialog, onSaved, onClose } = renderDialog()
    fireEvent.change(getNewValueInput(dialog!), { target: { value: 'New Co' } })
    fireEvent.click(within(dialog!).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(from).toHaveBeenCalledWith('v2_app_settings')
    expect(update).toHaveBeenCalledWith({ value: 'New Co', description: 'shown on PDFs' })
    expect(eq).toHaveBeenCalledWith('key', 'company_name')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('forwards supabase errors via onError and keeps the dialog open', async () => {
    eq.mockResolvedValueOnce({ error: { message: 'duplicate key' } })
    const { dialog, onSaved, onClose, onError } = renderDialog()
    fireEvent.change(getNewValueInput(dialog!), { target: { value: 'New Co' } })
    fireEvent.click(within(dialog!).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('duplicate key'))
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('treats an empty description as null on save', async () => {
    const { dialog, onSaved } = renderDialog()
    fireEvent.change(getNewValueInput(dialog!), { target: { value: 'New Co' } })
    fireEvent.change(within(dialog!).getByLabelText('Deskripsi'), {
      target: { value: '   ' },
    })
    fireEvent.click(within(dialog!).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith({ value: 'New Co', description: null })
  })
})
