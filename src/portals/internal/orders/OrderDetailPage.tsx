import { Navigate, useParams } from 'react-router-dom'

/** Deep link /internal/orders/:id → list with detail modal. */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/internal/orders" replace />
  return <Navigate to={`/internal/orders?order=${encodeURIComponent(id)}`} replace />
}
