import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, Box, CircularProgress, Container, Paper, Typography } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'

export function PartnerRoute() {
  const { user, loading: authLoading } = useAuth()
  const { partner, loading: partnerLoading } = usePartnerProfile(user?.id)
  const location = useLocation()

  if (authLoading || (user && partnerLoading)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!user || !partner) {
    return <Navigate to="/partner/login" replace state={{ from: location.pathname }} />
  }

  if (!partner.verified) {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Akun belum terverifikasi
          </Typography>
          <Alert severity="warning" sx={{ mt: 1 }}>
            Akun Anda sudah terdaftar namun belum terverifikasi oleh admin. Silakan hubungi admin untuk konfirmasi.
          </Alert>
        </Paper>
      </Container>
    )
  }

  return <Outlet />
}
