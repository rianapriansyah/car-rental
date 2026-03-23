import { Navigate, Route, Routes } from 'react-router-dom'
import { ColorModeProvider } from './contexts/ColorModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminRoute } from './components/routing/AdminRoute'
import { PartnerRoute } from './components/routing/PartnerRoute'
import { InternalLayout } from './portals/internal/InternalLayout'
import { InternalLoginPage } from './portals/internal/InternalLoginPage'
import { BootstrapAdminPage } from './portals/internal/BootstrapAdminPage'
import { CarsPage } from './portals/internal/cars/CarsPage'
import { PartnersPage } from './portals/internal/partners/PartnersPage'
import { InOutPage } from './portals/internal/inout/InOutPage'
import { RentalsPage } from './portals/internal/rentals/RentalsPage'
import { TransactionsPage } from './portals/internal/transactions/TransactionsPage'
import { RenterInfoPage } from './portals/internal/renterinfo/RenterInfoPage'
import { SettingsPage } from './portals/internal/settings/SettingsPage'
import { PartnerLayout } from './portals/partner/PartnerLayout'
import { PartnerDashboardPage } from './portals/partner/PartnerDashboardPage'
import { PartnerLoginPage } from './portals/partner/PartnerLoginPage'
import { PublicFleetPage } from './portals/public/PublicFleetPage'

export default function App() {
  return (
    <ColorModeProvider>
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
              <Route index element={<Navigate to="in-out" replace />} />
              <Route path="in-out" element={<InOutPage />} />
              <Route path="renter-info" element={<RenterInfoPage />} />
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
    </ColorModeProvider>
  )
}
