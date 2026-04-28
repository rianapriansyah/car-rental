import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

type AuthUser = { email: string } | null
const getUser = vi.fn(
  (..._args: unknown[]) =>
    Promise.resolve({
      data: { user: null as AuthUser },
      error: null as { message: string } | null,
    }),
)
const signInWithPassword = vi.fn(
  (..._args: unknown[]) =>
    Promise.resolve({ error: null as { message: string } | null }),
)

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  },
}))

import { CancelPasswordDialog } from './CancelPasswordDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof CancelPasswordDialog>> = {}) {
  const onClose = vi.fn()
  const onVerified = vi.fn()
  const utils = render(
    <CancelPasswordDialog open onClose={onClose} onVerified={onVerified} {...overrides} />,
  )
  const dialog = screen.getByRole('dialog')
  return { ...utils, onClose, onVerified, dialog }
}

function getInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(/Kata sandi/i) as HTMLInputElement
}

describe('CancelPasswordDialog', () => {
  beforeEach(() => {
    getUser.mockReset()
    signInWithPassword.mockReset()
  })

  it('shows an inline error when password is empty', () => {
    const { dialog, onVerified } = renderDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))
    expect(within(dialog).getByText('Masukkan kata sandi akun Anda.')).toBeInTheDocument()
    expect(onVerified).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('surfaces an error when the current user has no email', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const { dialog, onVerified } = renderDialog()
    fireEvent.change(getInput(dialog), { target: { value: 'whatever' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))
    expect(
      await within(dialog).findByText(/Tidak dapat memverifikasi pengguna/),
    ).toBeInTheDocument()
    expect(onVerified).not.toHaveBeenCalled()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows "Kata sandi salah." when sign-in fails', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: 'op@example.com' } },
      error: null,
    })
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'invalid' } })
    const { dialog, onVerified } = renderDialog()
    fireEvent.change(getInput(dialog), { target: { value: 'badpwd' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))
    expect(await within(dialog).findByText('Kata sandi salah.')).toBeInTheDocument()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'op@example.com',
      password: 'badpwd',
    })
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('calls onVerified after a successful sign-in', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: 'op@example.com' } },
      error: null,
    })
    signInWithPassword.mockResolvedValueOnce({ error: null })
    const { dialog, onVerified } = renderDialog()
    fireEvent.change(getInput(dialog), { target: { value: 'goodpwd' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'op@example.com',
      password: 'goodpwd',
    })
  })

  it('verifies on Enter key in the password input', async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: 'op@example.com' } },
      error: null,
    })
    signInWithPassword.mockResolvedValueOnce({ error: null })
    const { dialog, onVerified } = renderDialog()
    const input = getInput(dialog)
    fireEvent.change(input, { target: { value: 'goodpwd' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1))
  })

  it('calls onClose when "Batal" is clicked', () => {
    const { dialog, onClose } = renderDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears the input and previous error when reopened', async () => {
    const { rerender, dialog } = renderDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))
    expect(within(dialog).getByText('Masukkan kata sandi akun Anda.')).toBeInTheDocument()
    fireEvent.change(getInput(dialog), { target: { value: 'something' } })

    rerender(<CancelPasswordDialog open={false} onClose={() => {}} onVerified={() => {}} />)
    rerender(<CancelPasswordDialog open onClose={() => {}} onVerified={() => {}} />)

    const reopened = screen.getByRole('dialog')
    expect(getInput(reopened).value).toBe('')
    expect(within(reopened).queryByText('Masukkan kata sandi akun Anda.')).not.toBeInTheDocument()
  })
})
