import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/**
 * Landing page for Supabase invite / magic-link tokens.
 * After session is established from the URL, partner sets their password and enters the portal.
 */
export function PartnerAcceptInvitePage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setHasSession(!!session)
        setRegisteredEmail(session?.user?.email ?? null)
      }
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setHasSession(!!data.session)
        setRegisteredEmail(data.session?.user?.email ?? null)
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (password !== password2) {
      setError('Konfirmasi kata sandi tidak sama.')
      return
    }
    setBusy(true)
    const { error: uErr } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    navigate('/partner', { replace: true })
  }

  if (!ready) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!hasSession) {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h5" gutterBottom>
            Tautan undangan tidak valid atau kadaluarsa
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Buka email undangan terbaru dari admin, atau minta admin mengirim ulang undangan dari menu Mitra.
          </Typography>
          <Button component={RouterLink} to="/partner/login" variant="contained">
            Ke halaman masuk mitra
          </Button>
        </Paper>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Aktivasi akun mitra
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Buat kata sandi untuk menyelesaikan aktivasi.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email terdaftar"
            type="email"
            value={registeredEmail ?? ''}
            fullWidth
            slotProps={{
              input: { readOnly: true },
            }}
            helperText="Email ini sudah terhubung dengan undangan dan tidak dapat diubah di sini."
          />
          <TextField
            label="Kata sandi baru"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            inputProps={{ minLength: 8 }}
            helperText="Minimal 8 karakter."
          />
          <TextField
            label="Konfirmasi kata sandi"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan & lanjut'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/partner/login">
            Sudah punya akun? Masuk
          </Link>
        </Typography>
      </Paper>
    </Container>
  )
}
