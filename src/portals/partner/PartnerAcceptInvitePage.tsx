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
 * Landing page for Supabase invite / magic-link tokens (PKCE).
 * After session is established from the URL, partner sets their password and enters the portal.
 * Mirrors exchangeCodeForSession + session wait from Defina CompleteInvite to avoid missing session on mobile Safari.
 */
export function PartnerAcceptInvitePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const applySession = (userEmail: string | undefined | null) => {
      if (cancelled || !userEmail) return false
      setRegisteredEmail(userEmail)
      setSessionReady(true)
      setLoading(false)
      setError(null)
      window.history.replaceState({}, document.title, window.location.pathname)
      return true
    }

    const fail = (message: string) => {
      if (cancelled) return
      setError(message)
      setLoading(false)
      setSessionReady(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (applySession(nextSession?.user?.email)) {
          subscription.unsubscribe()
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    })

    void (async () => {
      try {
        const href = window.location.href
        const url = new URL(href)
        if (url.searchParams.get('code')) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(href)
          if (cancelled) return
          if (exchangeErr) {
            fail(exchangeErr.message)
            subscription.unsubscribe()
            return
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return
        if (applySession(session?.user?.email)) {
          subscription.unsubscribe()
          return
        }

        timeoutId = setTimeout(async () => {
          if (cancelled) return
          const {
            data: { session: late },
          } = await supabase.auth.getSession()
          if (cancelled) return
          if (applySession(late?.user?.email)) {
            subscription.unsubscribe()
            return
          }
          fail(
            'Tautan undangan tidak valid atau kadaluarsa. Minta admin mengirim ulang undangan, atau masuk jika akun sudah diaktifkan.',
          )
          subscription.unsubscribe()
        }, 2000)
      } catch (e) {
        if (!cancelled) {
          fail(e instanceof Error ? e.message : 'Gagal memverifikasi undangan.')
          subscription.unsubscribe()
        }
      }
    })()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
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
    if (uErr) {
      setBusy(false)
      setError(uErr.message)
      return
    }
    const { error: claimErr } = await supabase.rpc('claim_partner_for_current_user')
    setBusy(false)
    if (claimErr) {
      console.warn('claim_partner_for_current_user:', claimErr.message)
    }
    navigate('/internal/home', { replace: true })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!sessionReady) {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h5" gutterBottom>
            Tautan undangan tidak valid atau kadaluarsa
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error ??
              'Buka email undangan terbaru dari admin, atau minta admin mengirim ulang undangan dari menu Mitra.'}
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained">
            Ke halaman masuk
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
          <Link component={RouterLink} to="/login">
            Sudah punya akun? Masuk
          </Link>
        </Typography>
      </Paper>
    </Container>
  )
}
