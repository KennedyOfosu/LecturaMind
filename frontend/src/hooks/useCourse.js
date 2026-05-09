import { useState, useEffect } from 'react'
import { courseService } from '../services/courseService'

/**
 * Hook that fetches a single course by ID.
 * @param {string} courseId
 */
export function useCourse(courseId) {
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    courseService.getById(courseId)
      .then((res) => setCourse(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load course'))
      .finally(() => setLoading(false))
  }, [courseId])

  return { course, loading, error }
}
