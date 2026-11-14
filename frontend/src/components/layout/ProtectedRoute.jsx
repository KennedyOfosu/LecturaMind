/**
 * ProtectedRoute.jsx — Guards routes by auth status and role.
 * Redirects unauthenticated users to /login and wrong-role users to their dashboard.
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageSpinner } from '../ui/Spinner'
import { dashboardPath } from '../../utils/roleGuard'

export function ProtectedRoute({ children, role }) {
  const { user, loading, authError, retryAuth } = useAuth()

  if (loading) return <PageSpinner />
  if (authError) return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-gray-900">Could not verify your session</h1>
        <p className="mt-2 text-sm text-gray-600">Your saved sign-in is still available. Check your connection and try again.</p>
        <button className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white" onClick={retryAuth}>Retry</button>
      </div>
    </main>
  )
  if (!user) return <Navigate to="/login" replace />

  if (role) {
    const roles = Array.isArray(role) ? role : [role]
    if (!roles.includes(user.role) && user.role !== 'superadmin') {
      return <Navigate to={dashboardPath(user.role)} replace />
    }
  }

  return children
}
