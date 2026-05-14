/**
 * StudentLayout.jsx — Wrapper for all student pages.
 * Provides the shared sidebar, scrollable main content, and:
 *   - Emits student_login on every page so the student is always in
 *     their course rooms (enables real-time announcement delivery).
 *   - Renders AnnouncementToast so notifications appear on every page.
 */

import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { courseService } from '../../services/courseService'
import StudentSidebar from './StudentSidebar'
import AnnouncementToast from '../realtime/AnnouncementToast'

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user }   = useAuth()
  const { socket } = useSocket()

  // Emit student_login every time the socket becomes available (initial connect
  // or after a disconnect/reconnect). This keeps the student in their course
  // rooms on every page so new_announcement events are always delivered.
  useEffect(() => {
    if (!socket || !user) return

    const emitLogin = () => {
      courseService.getEnrolled()
        .then((res) => {
          const courseIds = (res.data || []).map((c) => c.id)
          socket.emit('student_login', {
            student_id:        user.id,
            student_name:      user.full_name,
            student_id_number: user.user_id_number,
            programme:         user.programme,
            level:             user.level,
            course_ids:        courseIds,
          })
        })
        .catch(() => {})
    }

    // socket is non-null only when already connected (SocketContext sets it
    // inside the 'connect' handler), so emit immediately every time it appears.
    emitLogin()

    // Also re-emit on any future reconnects within this socket instance.
    socket.on('connect', emitLogin)
    return () => socket.off('connect', emitLogin)
  }, [socket, user])

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      <StudentSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      <main className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: '#F0F0F2' }}>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>

      {/* Global real-time announcement toast — visible on every student page */}
      <AnnouncementToast />
    </div>
  )
}
