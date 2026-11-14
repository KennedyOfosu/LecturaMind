import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { courseService } from '../services/courseService'
import { useAuth } from '../hooks/useAuth'

const CoursesContext = createContext(null)

export function CoursesProvider({ children }) {
  const { user, token } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const identity = user?.id && token ? `${user.id}:${user.role}` : null
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const res = await courseService.getEnrolled()
      // Handle both old format (array directly) and new format ({data: [...], data_warnings: [...]})
      const coursesData = res.data?.data || res.data
      if (currentRequest === requestId.current) setCourses(Array.isArray(coursesData) ? coursesData : [])
    } catch (err) {
      if (currentRequest === requestId.current) {
        setCourses([])
        setError(err)
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    requestId.current += 1
    setCourses([])
    setError(null)
    if (identity) refresh()
    else setLoading(false)
    return () => { requestId.current += 1 }
  }, [identity, refresh])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const refreshCourses = useCallback(() => refreshRef.current(), [])

  return (
    <CoursesContext.Provider value={{ courses, loading, error, refresh: refreshCourses }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
