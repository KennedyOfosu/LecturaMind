/**
 * ActiveUsersList.jsx — Live list of currently online students.
 */

import { OnlineIndicator } from './OnlineIndicator'

export function ActiveUsersList({ users = [] }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-3xl mb-2">👤</div>
        <p className="text-sm">No students online right now</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map((u) => {
        const initials = u.name
          ? u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
          : '?'
        return (
          <div
            key={u.user_id}
            className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl animate-fade-in"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
              <OnlineIndicator className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{u.name}</p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
