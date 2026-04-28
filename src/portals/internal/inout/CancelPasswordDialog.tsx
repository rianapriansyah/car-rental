import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'

type Props = {
  open: boolean
  onClose: () => void
  /** Called once the password has been verified successfully. */
  onVerified: () => void
}

export function CancelPasswordDialog({ open, onClose, onVerified }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setError(null)
      setVerifying(false)
    }
  }, [open])

  const requestClose = () => {
    if (verifying) return
    onClose()
  }

  async function verify() {
    setError(null)
    if (!password) {
      setError('Masukkan kata sandi akun Anda.')
      return
    }
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      setError(userError?.message ?? 'Tidak dapat memverifikasi pengguna. Silakan login ulang.')
      return
    }
    setVerifying(true)
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    setVerifying(false)
    if (signError) {
      setError('Kata sandi salah.')
      return
    }
    onVerified()
  }

  return (
    <Dialog open={open} onClose={requestClose} fullWidth maxWidth="xs">
      <DialogTitle>Konfirmasi kata sandi</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Masukkan kata sandi akun Anda untuk melanjutkan pembatalan sewa.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          size="small"
          type="password"
          label="Kata sandi"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void verify()
            }
          }}
          error={Boolean(error)}
          helperText={error ?? undefined}
          autoComplete="current-password"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={requestClose} disabled={verifying}>
          Batal
        </Button>
        <Button variant="contained" onClick={() => void verify()} disabled={verifying}>
          {verifying ? 'Memverifikasi…' : 'Lanjutkan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
