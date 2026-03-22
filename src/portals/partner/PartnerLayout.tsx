import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState } from 'react'
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'

export function PartnerLayout() {
  const theme = useTheme()
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'))
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { user, signOut } = useAuth()
  const { partner } = usePartnerProfile(user?.id)
  const navigate = useNavigate()

  const closeMenu = () => setAnchorEl(null)

  async function doSignOut() {
    closeMenu()
    await signOut()
    navigate('/partner/login', { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar
          sx={{
            gap: 1,
            flexWrap: 'wrap',
            py: { xs: 1, sm: 0 },
            minHeight: { xs: 56, sm: 64 },
          }}
        >
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
            noWrap
            component="div"
          >
            Partner{partner ? `: ${partner.name}` : ''}
          </Typography>
          {isSmUp ? (
            <>
              <Button component={RouterLink} to="/public" color="inherit" size="small">
                Public fleet
              </Button>
              <Button color="inherit" size="small" onClick={() => void doSignOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <IconButton color="inherit" aria-label="menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MoreVertIcon />
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
                <MenuItem component={RouterLink} to="/public" onClick={closeMenu}>
                  Public fleet
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void doSignOut()
                  }}
                >
                  Sign out
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, maxWidth: '100%', overflowX: 'hidden' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
