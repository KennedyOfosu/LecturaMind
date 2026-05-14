/**
 * StudentLayout.jsx — Wrapper for all student pages.
 * Provides the shared sidebar + scrollable main content area.
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import StudentSidebar from './StudentSidebar'

const ToggleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
  </svg>
)

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      <StudentSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col relative" style={{ backgroundColor: '#F0F0F2' }}>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 transition-colors z-10">
            <ToggleIcon />
          </button>
        )}
        {/* Outlet wrapper — overflow-y-auto so regular pages scroll, dashboard manages its own */}
        <div className={`flex-1 overflow-y-auto p-8 ${!sidebarOpen ? 'pl-14' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
