import { Navigate, Route, Routes } from 'react-router-dom'
import { ColorModeProvider } from './contexts/ColorModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthenticatedRoute } from './components/routing/AuthenticatedRoute'
import { LoginPage } from './portals/LoginPage'
import { InternalLayout } from './portals/internal/InternalLayout'
import { BootstrapAdminPage } from './portals/internal/BootstrapAdminPage'
import { HomePage } from './portals/internal/home/HomePage'
import { CarsPage } from './portals/internal/cars/CarsPage'
import { CarDetailPage } from './portals/internal/cars/CarDetailPage'
import { PartnersPage } from './portals/internal/partners/PartnersPage'
import { InOutPage } from './portals/internal/inout/InOutPage'
import { RentalsPage } from './portals/internal/rentals/RentalsPage'
import { OrdersListPage } from './portals/internal/orders/OrdersListPage'
import { OrderDetailPage } from './portals/internal/orders/OrderDetailPage'
import { TransactionsPage } from './portals/internal/transactions/TransactionsPage'
import { RenterInfoPage } from './portals/internal/renterinfo/RenterInfoPage'
import { SettingsPage } from './portals/internal/settings/SettingsPage'
import { PartnerAcceptInvitePage } from './portals/partner/PartnerAcceptInvitePage'
import { PublicFleetPage } from './portals/public/PublicFleetPage'
import { TvDisplayPage } from './portals/public/TvDisplayPage'

export default function App() {
  return (
    <ColorModeProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/public" replace />} />
          <Route path="/public" element={<PublicFleetPage />} />
          <Route path="/tv" element={<TvDisplayPage />} />

          <Route path="/login" element={<LoginPage />} />
          {/* Legacy login paths — redirect to unified /login */}
          <Route path="/internal/login" element={<Navigate to="/login" replace />} />
          <Route path="/partner/login" element={<Navigate to="/login" replace />} />
          {/* Legacy partner portal — redirect to unified internal */}
          <Route path="/partner" element={<Navigate to="/internal/home" replace />} />
          <Route path="/partner/accept-invite" element={<PartnerAcceptInvitePage />} />

          <Route path="/internal/bootstrap-admin" element={<BootstrapAdminPage />} />
          <Route path="/internal" element={<AuthenticatedRoute />}>
            <Route element={<InternalLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="in-out" element={<InOutPage />} />
              <Route path="renter-info" element={<RenterInfoPage />} />
              <Route path="cars" element={<CarsPage />} />
              <Route path="cars/:carId" element={<CarDetailPage />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="rentals" element={<RentalsPage />} />
              <Route path="orders" element={<OrdersListPage />} />
              <Route path="orders/new" element={<Navigate to="/internal/orders" replace />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
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
