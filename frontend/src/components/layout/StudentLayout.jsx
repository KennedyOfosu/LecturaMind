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
import { useCourses } from '../../context/CoursesContext'
import StudentSidebar from './StudentSidebar'
import AnnouncementToast from '../realtime/AnnouncementToast'

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user }    = useAuth()
  const { socket }  = useSocket()
  const { courses } = useCourses()

  // Emit student_login every time the socket or courses list becomes available.
  // Uses the shared CoursesContext so no extra getEnrolled() call is made here.
  useEffect(() => {
    if (!socket || !user || !courses.length) return

    const emitLogin = () => {
      socket.emit('student_login', {
        student_id:        user.id,
        student_name:      user.full_name,
        student_id_number: user.user_id_number,
        programme:         user.programme,
        level:             user.level,
        course_ids:        courses.map((c) => c.id),
      })
    }

    emitLogin()
    socket.on('connect', emitLogin)
    return () => socket.off('connect', emitLogin)
  }, [socket, user, courses])

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
