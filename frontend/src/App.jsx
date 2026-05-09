/**
 * App.jsx — Root component with full client-side routing and provider setup.
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Navbar } from './components/layout/Navbar'
import { Sidebar } from './components/layout/Sidebar'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'

// Lecturer pages
import LecturerDashboard from './pages/lecturer/LecturerDashboard'
import CourseManager from './pages/lecturer/CourseManager'
import MaterialUploader from './pages/lecturer/MaterialUploader'
import AnnouncementManager from './pages/lecturer/AnnouncementManager'
import ChatLogs from './pages/lecturer/ChatLogs'
import LiveStudentMonitor from './pages/lecturer/LiveStudentMonitor'
import QuizManager from './pages/lecturer/QuizManager'
import LecturerLiveQnA from './pages/lecturer/LiveQnA'

// Student pages
import StudentDashboard from './pages/student/StudentDashboard'
import CourseView from './pages/student/CourseView'

/** Shared layout with navbar + sidebar */
function DashboardLayout({ role }) {
  return (
    <ProtectedRoute role={role}>
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Lecturer routes */}
              <Route element={<DashboardLayout role="lecturer" />}>
                <Route path="/lecturer/dashboard" element={<LecturerDashboard />} />
                <Route path="/lecturer/courses" element={<CourseManager />} />
                <Route path="/lecturer/materials" element={<MaterialUploader />} />
                <Route path="/lecturer/announcements" element={<AnnouncementManager />} />
                <Route path="/lecturer/chat-logs" element={<ChatLogs />} />
                <Route path="/lecturer/live-monitor" element={<LiveStudentMonitor />} />
                <Route path="/lecturer/quizzes" element={<QuizManager />} />
                <Route path="/lecturer/live-qna" element={<LecturerLiveQnA />} />
              </Route>

              {/* Student routes */}
              <Route element={<DashboardLayout role="student" />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/courses/:courseId" element={<CourseView />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
