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
import { usePartnerProfile } from '../../hooks/usePartnerProfile'

export function PartnerLoginPage() {
  const { user, loading: authLoading } = useAuth()
  const { partner, loading: partnerLoading } = usePartnerProfile(user?.id)
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/partner'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const checking = authLoading || (!!user && partnerLoading)

  useEffect(() => {
    if (user && !partnerLoading && !partner) {
      setError('No partner profile is linked to this account.')
    } else if (partner) {
      setError(null)
    }
  }, [user, partner, partnerLoading])

  if (!checking && user && partner) {
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
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4, md: 8 }, mb: 4, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Partner sign in
        </Typography>
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
          <Link component={RouterLink} to="/public">
            View public fleet
          </Link>
        </Typography>
      </Paper>
    </Container>
  )
}
