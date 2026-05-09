/**
 * ProtectedRoute.jsx — Guards routes by auth status and role.
 * Redirects unauthenticated users to /login and wrong-role users to their dashboard.
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageSpinner } from '../ui/Spinner'
import { dashboardPath } from '../../utils/roleGuard'

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={dashboardPath(user.role)} replace />

  return children
}
