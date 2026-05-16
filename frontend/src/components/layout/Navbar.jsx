/**
 * Navbar.jsx — Top navigation bar with role-aware user menu.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../ui/Badge'
import { useToast } from '../ui/Toast'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <nav className="bg-navy text-white shadow-lg h-16 flex items-center px-6 gap-4 sticky top-0 z-40">
      <Link to="/" className="flex items-center mr-6">
        <img
          src="/LecturaMind%20Logo.svg"
          alt="LecturaMind"
          style={{ height: '28px', width: 'auto', filter: 'brightness(0) invert(1)' }}
        />
      </Link>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <Badge variant={user.role === 'lecturer' ? 'teal' : 'success'} className="capitalize">
            {user.role}
          </Badge>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-teal flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <span className="text-sm hidden sm:block">{user.full_name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
