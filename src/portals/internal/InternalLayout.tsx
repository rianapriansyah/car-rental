import MenuIcon from '@mui/icons-material/Menu'
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { InternalAppearanceBar } from '../../components/InternalAppearanceBar'
import { useAuth } from '../../hooks/useAuth'

const DRAWER_WIDTH = 260

const nav = [
  { to: '/internal/cars', label: 'Cars' },
  { to: '/internal/partners', label: 'Partners' },
  { to: '/internal/rentals', label: 'Rentals' },
  { to: '/internal/transactions', label: 'Transactions' },
  { to: '/internal/settings', label: 'Settings' },
]

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <List disablePadding sx={{ pt: 1 }}>
      {nav.map((item) => {
        const selected = pathname === item.to || pathname.startsWith(`${item.to}/`)
        return (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={selected}
            onClick={onNavigate}
            sx={{ pl: 2, pr: 2, py: 1.25, borderRadius: '8px', mx: 1 }}
          >
            <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItemButton>
        )
      })}
    </List>
  )
}

export function InternalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const toggleDrawer = () => setDrawerOpen((open) => !open)
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        <AppBar position="fixed" elevation={2} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={toggleDrawer}
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              sx={{
                mr: 1,
                border: 1,
                borderColor: 'rgba(255,255,255,0.5)',
                borderRadius: '8px',
                '&:hover': { borderColor: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Internal dashboard
            </Typography>
            <Button color="inherit" component={Link} to="/public" size="small" sx={{ minHeight: 40, textTransform: 'none' }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Public fleet
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Fleet
              </Box>
            </Button>
            <Button
              color="inherit"
              size="small"
              sx={{ textTransform: 'none' }}
              onClick={async () => {
                await signOut()
                navigate('/internal/login', { replace: true })
              }}
            >
              Sign out
            </Button>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={closeDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              top: { xs: 56, sm: 64 },
              height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
            },
          }}
        >
          <NavList pathname={pathname} onNavigate={closeDrawer} />
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%',
            minWidth: 0,
            p: { xs: 2, sm: 2.5, md: 3 },
            maxWidth: '100vw',
            overflowX: 'hidden',
          }}
        >
          <Toolbar />
          <InternalAppearanceBar />
          <Outlet />
        </Box>
      </Box>
    </LocalizationProvider>
  )
}
