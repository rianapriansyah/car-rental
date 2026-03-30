import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, Box, CircularProgress, Container, Paper, Typography } from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'
import { isInternalStaffUser } from '../../lib/authRole'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'

export function AuthenticatedRoute() {
  const { user, loading: authLoading } = useAuth()
  const isStaff = user ? isInternalStaffUser(user) : false
  const { partner, loading: partnerLoading } = usePartnerProfile(isStaff ? undefined : user?.id)
  const location = useLocation()

  if (authLoading || (!isStaff && user && partnerLoading)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isStaff) {
    if (!partner) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />
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
  }

  return <Outlet />
}
