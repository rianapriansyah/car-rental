import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
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

  return <Outlet />
}
