/**
 * ActiveUsersList.jsx — Live list of currently online students.
 */

import { OnlineIndicator } from './OnlineIndicator'

export function ActiveUsersList({ users = [] }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm font-medium">No students are currently online</p>
        <p className="text-xs mt-1">Students will appear here when they log into their dashboard</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {users.map((u) => {
        const id   = u.student_id || u.user_id
        const name = u.student_name || u.name || 'Student'
        const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div
            key={id}
            className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl animate-fade-in"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
              <OnlineIndicator className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
              {u.id_number && (
                <p className="text-xs text-gray-500 truncate">{u.id_number}</p>
              )}
              {(u.programme || u.level) && (
                <p className="text-xs text-gray-400 truncate">
                  {[u.programme, u.level && `Level ${u.level}`].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
