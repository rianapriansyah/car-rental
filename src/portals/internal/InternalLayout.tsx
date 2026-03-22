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
import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const drawerWidth = 240

const nav = [
  { to: '/internal/cars', label: 'Cars' },
  { to: '/internal/partners', label: 'Partners' },
  { to: '/internal/rentals', label: 'Rentals' },
  { to: '/internal/transactions', label: 'Transactions' },
  { to: '/internal/settings', label: 'Settings' },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <List sx={{ px: 1 }}>
      {nav.map((item) => (
        <ListItemButton
          key={item.to}
          component={Link}
          to={item.to}
          onClick={onNavigate}
          sx={{ borderRadius: 1, py: 1.25 }}
        >
          <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
        </ListItemButton>
      ))}
    </List>
  )
}

export function InternalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleDrawerToggle = () => {
    setMobileOpen((o) => !o)
  }

  const closeMobile = () => {
    setMobileOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit"
            aria-label="open navigation"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { md: 'none' }, mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Internal dashboard
          </Typography>
          <Button color="inherit" component={Link} to="/public" size="small" sx={{ minHeight: 40 }}>
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
            onClick={async () => {
              await signOut()
              navigate('/internal/login', { replace: true })
            }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          <Toolbar />
          <NavList onNavigate={closeMobile} />
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          <Toolbar />
          <NavList />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 2.5, md: 3 },
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
