/**
 * App.jsx — Root routing with Synapse-style layouts for all dashboard pages.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LecturerLayout from './components/layout/LecturerLayout'
import StudentLayout from './components/layout/StudentLayout'

// Public pages
import Landing  from './pages/Landing'
import Login    from './pages/Login'
import Register from './pages/Register'

// Lecturer pages
import LecturerDashboard    from './pages/lecturer/LecturerDashboard'
import CourseManager        from './pages/lecturer/CourseManager'
import MaterialUploader     from './pages/lecturer/MaterialUploader'
import AnnouncementManager  from './pages/lecturer/AnnouncementManager'
import ChatLogs             from './pages/lecturer/ChatLogs'
import LiveStudentMonitor   from './pages/lecturer/LiveStudentMonitor'
import QuizManager          from './pages/lecturer/QuizManager'
import LecturerLiveQnA      from './pages/lecturer/LiveQnA'

// Student pages
import StudentDashboard from './pages/student/StudentDashboard'
import CourseView       from './pages/student/CourseView'
import StudentProfile   from './pages/student/StudentProfile'

// Lecturer profile page
import LecturerProfile  from './pages/lecturer/LecturerProfile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Routes>
              {/* ── Public ── */}
              <Route path="/"         element={<Landing />} />
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* ── All lecturer pages inside LecturerLayout (shared sidebar) ── */}
              <Route element={<ProtectedRoute role="lecturer"><LecturerLayout /></ProtectedRoute>}>
                <Route path="/lecturer/dashboard"     element={<LecturerDashboard />} />
                <Route path="/lecturer/courses"       element={<CourseManager />} />
                <Route path="/lecturer/materials"     element={<MaterialUploader />} />
                <Route path="/lecturer/announcements" element={<AnnouncementManager />} />
                <Route path="/lecturer/chat-logs"     element={<ChatLogs />} />
                <Route path="/lecturer/live-monitor"  element={<LiveStudentMonitor />} />
                <Route path="/lecturer/quizzes"       element={<QuizManager />} />
                <Route path="/lecturer/live-qna"      element={<LecturerLiveQnA />} />
                <Route path="/lecturer/profile"       element={<LecturerProfile />} />
              </Route>

              {/* ── Student dashboard (standalone layout) ── */}
              <Route path="/student/dashboard" element={
                <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
              } />

              {/* ── Student inner pages (Synapse layout) ── */}
              <Route element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
                <Route path="/student/courses/:courseId" element={<CourseView />} />
                <Route path="/student/profile"           element={<StudentProfile />} />
              </Route>

              {/* ── Fallback ── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
