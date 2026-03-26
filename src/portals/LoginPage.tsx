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
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isAdminUser } from '../lib/authRole'
import { isAdminBootstrapEnabled } from '../lib/bootstrapAdmin'

export function LoginPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Where to go once user is confirmed in React state.
  // Set in onSubmit after role is determined; navigation fires via the effect below.
  const [destination, setDestination] = useState<string | null>(null)

  // Navigate only from an effect — this runs AFTER React commits all state,
  // including the `user` update from onAuthStateChange. Calling navigate() inside
  // an async handler fires before React processes that update, causing route guards
  // to see user=null and bounce back to /login (the throttled-navigation loop).
  useEffect(() => {
    if (!destination || !user) return
    navigate(destination, { replace: true })
    setDestination(null)
  }, [destination, user, navigate])

  // ── 1. Session resolving ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  // ── 2. Already signed in (returning to /login while authenticated) ──────────
  if (user) {
    return (
      <Navigate
        to={isAdminUser(user) ? (from ?? '/internal/in-out') : (from ?? '/internal/home')}
        replace
      />
    )
  }

  // ── 3. Async work in progress (determining role or awaiting sign-out) ───────
  if (busy) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  // ── 4. Form ─────────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password })

    if (signError || !data.user) {
      setBusy(false)
      setError(signError?.message ?? 'Login gagal.')
      return
    }

    // Admin — set destination and keep spinner.
    // The effect above will call navigate() once onAuthStateChange updates user.
    if (isAdminUser(data.user)) {
      setDestination(from ?? '/internal/in-out')
      return
    }

    // Partner — auth_user_id is set server-side on invite; validate profile + verification.
    const { data: row } = await supabase
      .from('v2_partners')
      .select('id, verified')
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (!row) {
      await supabase.auth.signOut()
      setBusy(false)
      setError('Tidak ada profil mitra yang terhubung dengan akun ini.')
      return
    }

    if (!row.verified) {
      await supabase.auth.signOut()
      setBusy(false)
      setError('Akun belum diverifikasi. Silakan hubungi admin.')
      return
    }

    // Valid partner — set destination and keep spinner.
    // The effect above will call navigate() once onAuthStateChange updates user.
    setDestination(from ?? '/internal/home')
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Masuk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Admin dan mitra menggunakan halaman ini.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box
          component="form"
          onSubmit={(e) => void onSubmit(e)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            label="Kata sandi"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained">
            Masuk
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {isAdminBootstrapEnabled() ? (
            <Link component={RouterLink} to="/internal/bootstrap-admin">
              Daftar admin pertama
            </Link>
          ) : null}
          <Link component={RouterLink} to="/public">
            Lihat armada publik
          </Link>
        </Typography>
      </Paper>
    </Container>
  )
}
