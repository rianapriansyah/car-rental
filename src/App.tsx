import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminRoute } from './components/routing/AdminRoute'
import { PartnerRoute } from './components/routing/PartnerRoute'
import { InternalLayout } from './portals/internal/InternalLayout'
import { InternalLoginPage } from './portals/internal/InternalLoginPage'
import { BootstrapAdminPage } from './portals/internal/BootstrapAdminPage'
import { CarsPage } from './portals/internal/cars/CarsPage'
import { PartnersPage } from './portals/internal/partners/PartnersPage'
import { RentalsPage } from './portals/internal/rentals/RentalsPage'
import { TransactionsPage } from './portals/internal/transactions/TransactionsPage'
import { SettingsPage } from './portals/internal/settings/SettingsPage'
import { PartnerLayout } from './portals/partner/PartnerLayout'
import { PartnerDashboardPage } from './portals/partner/PartnerDashboardPage'
import { PartnerLoginPage } from './portals/partner/PartnerLoginPage'
import { PublicFleetPage } from './portals/public/PublicFleetPage'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#6a1b9a' },
  },
  typography: {
    htmlFontSize: 16,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: false },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
        sizeLarge: {
          minHeight: 48,
          paddingLeft: 22,
          paddingRight: 22,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 10,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
})

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/public" replace />} />
          <Route path="/public" element={<PublicFleetPage />} />

          <Route path="/partner/login" element={<PartnerLoginPage />} />
          <Route path="/partner" element={<PartnerRoute />}>
            <Route element={<PartnerLayout />}>
              <Route index element={<PartnerDashboardPage />} />
            </Route>
          </Route>

          <Route path="/internal/login" element={<InternalLoginPage />} />
          <Route path="/internal/bootstrap-admin" element={<BootstrapAdminPage />} />
          <Route path="/internal" element={<AdminRoute />}>
            <Route element={<InternalLayout />}>
              <Route index element={<Navigate to="cars" replace />} />
              <Route path="cars" element={<CarsPage />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="rentals" element={<RentalsPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/public" replace />} />
        </Routes>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
