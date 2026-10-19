/**
 * App.jsx — Root routing with shared layouts for all dashboard pages.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }       from './context/AuthContext'
import { SocketProvider }     from './context/SocketContext'
import { SessionsProvider }   from './context/SessionsContext'
import { CoursesProvider }    from './context/CoursesContext'
import { ToastProvider }      from './components/ui/Toast'
import { ProtectedRoute }     from './components/layout/ProtectedRoute'
import { OnboardingProvider } from './context/OnboardingContext'
import LecturerLayout       from './components/layout/LecturerLayout'
import StudentLayout        from './components/layout/StudentLayout'
import SuperadminLayout     from './components/layout/SuperadminLayout'

// Public pages
import Landing  from './pages/Landing'
import Login    from './pages/Login'
import Register from './pages/Register'
import ActivateAccount from './pages/ActivateAccount'

// Lecturer pages
import LecturerDashboard   from './pages/lecturer/LecturerDashboard'
import CourseManager       from './pages/lecturer/CourseManager'
import MaterialUploader    from './pages/lecturer/MaterialUploader'
import AnnouncementManager from './pages/lecturer/AnnouncementManager'
import ChatLogs            from './pages/lecturer/ChatLogs'
import LiveStudentMonitor  from './pages/lecturer/LiveStudentMonitor'
import QuizManager         from './pages/lecturer/QuizManager'
import LecturerLiveQnA     from './pages/lecturer/LiveQnA'
import LecturerProfile     from './pages/lecturer/LecturerProfile'
import CourseStudentView   from './pages/lecturer/CourseStudentView'

// Student pages
import StudentDashboard from './pages/student/StudentDashboard'
import CourseView       from './pages/student/CourseView'
import StudentProfile   from './pages/student/StudentProfile'

// Superadmin pages
import SuperadminDashboard   from './pages/superadmin/SuperadminDashboard'
import UserManagement        from './pages/superadmin/UserManagement'
import CourseManagement      from './pages/superadmin/CourseManagement'
import ClassroomManagement   from './pages/superadmin/ClassroomManagement'
import AcademicStructure     from './pages/superadmin/AcademicStructure'
import Allocations           from './pages/superadmin/Allocations'
import Enrolments            from './pages/superadmin/Enrolments'
import AttendanceOversight   from './pages/superadmin/AttendanceOversight'
import ReportCards           from './pages/superadmin/ReportCards'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <OnboardingProvider>
            <Routes>
              {/* ── Public ── */}
              <Route path="/"         element={<Landing />} />
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/activate-account" element={<ActivateAccount />} />

              {/* ── Lecturer pages (shared sidebar layout) ── */}
              <Route element={<ProtectedRoute role="lecturer"><LecturerLayout /></ProtectedRoute>}>
                <Route path="/lecturer/dashboard"     element={<LecturerDashboard />} />
                <Route path="/lecturer/courses"       element={<CourseManager />} />
                <Route path="/lecturer/materials"     element={<MaterialUploader />} />
                <Route path="/lecturer/announcements" element={<AnnouncementManager />} />
                <Route path="/lecturer/chat-logs"     element={<ChatLogs />} />
                <Route path="/lecturer/live-monitor"  element={<LiveStudentMonitor />} />
                <Route path="/lecturer/quizzes"       element={<QuizManager />} />
                <Route path="/lecturer/live-qna"      element={<LecturerLiveQnA />} />
                <Route path="/lecturer/profile"                           element={<LecturerProfile />} />
                <Route path="/lecturer/courses/:courseId/students"    element={<CourseStudentView />} />
              </Route>

              {/* ── All student pages wrapped in SessionsProvider + StudentLayout ── */}
              <Route element={
                <ProtectedRoute role="student">
                  <CoursesProvider>
                    <SessionsProvider>
                      <StudentLayout />
                    </SessionsProvider>
                  </CoursesProvider>
                </ProtectedRoute>
              }>
                <Route path="/student/dashboard"          element={<StudentDashboard />} />
                <Route path="/student/courses/:courseId"  element={<CourseView />} />
                <Route path="/student/course/:courseId"   element={<CourseView />} />
                <Route path="/student/profile"            element={<StudentProfile />} />
              </Route>

              {/* ── Superadmin pages ── */}
              <Route element={<ProtectedRoute role="superadmin"><SuperadminLayout /></ProtectedRoute>}>
                <Route path="/superadmin/dashboard"    element={<SuperadminDashboard />} />
                <Route path="/superadmin/users"        element={<UserManagement />} />
                <Route path="/superadmin/courses"      element={<CourseManagement />} />
                <Route path="/superadmin/classrooms"   element={<ClassroomManagement />} />
                <Route path="/superadmin/academics"    element={<AcademicStructure />} />
                <Route path="/superadmin/allocations"  element={<Allocations />} />
                <Route path="/superadmin/enrolments"   element={<Enrolments />} />
                <Route path="/superadmin/attendance"   element={<AttendanceOversight />} />
                <Route path="/superadmin/report-cards" element={<ReportCards />} />
              </Route>

              {/* ── Fallback ── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </OnboardingProvider>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
