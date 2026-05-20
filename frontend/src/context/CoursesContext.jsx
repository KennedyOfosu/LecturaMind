import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { courseService } from '../services/courseService'
import { useAuth } from '../hooks/useAuth'

const CoursesContext = createContext(null)

export function CoursesProvider({ children }) {
  const { user, token } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await courseService.getEnrolled()
      setCourses(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && token) refresh()
  }, [user, token, refresh])

  return (
    <CoursesContext.Provider value={{ courses, loading, error, refresh }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
