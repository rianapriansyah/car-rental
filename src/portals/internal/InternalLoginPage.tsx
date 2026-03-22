import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { isAdminUser } from '../../lib/authRole'
import { isAdminBootstrapEnabled } from '../../lib/bootstrapAdmin'

export function InternalLoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/internal/cars'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [roleError, setRoleError] = useState(false)

  useEffect(() => {
    if (user && !isAdminUser(user)) {
      setRoleError(true)
    } else {
      setRoleError(false)
    }
  }, [user])

  if (!loading && user && isAdminUser(user)) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signError) {
      setError(signError.message)
      return
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Admin sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Internal tools require an account with{' '}
          <code>app_metadata.role = &quot;admin&quot;</code>.
        </Typography>
        {roleError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This account is not an admin.{' '}
            <Button size="small" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            Sign in
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          {isAdminBootstrapEnabled() ? (
            <>
              <Link component={RouterLink} to="/internal/bootstrap-admin">
                First-time admin registration
              </Link>
              {' · '}
            </>
          ) : null}
          <Link component={RouterLink} to="/public">
            View public fleet
          </Link>
        </Typography>
      </Paper>
    </Container>
  )
}
