/**
 * StudentLayout.jsx — Wrapper for all student pages.
 * Provides the shared sidebar + scrollable main content area.
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import StudentSidebar from './StudentSidebar'

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      <StudentSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: '#F0F0F2' }}>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
