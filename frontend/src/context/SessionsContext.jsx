import { createContext, useContext, useState, useCallback } from 'react'
import { chatService } from '../services/chatService'

const SessionsContext = createContext(null)

export function SessionsProvider({ children }) {
  const [sessions,          setSessions]          = useState([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)

  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const res = await chatService.getStudentSessions(40)
      setSessions(res.data.sessions || [])
    } catch (err) {
      console.warn('[Sessions] refresh failed:', err?.response?.status, err?.message)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  return (
    <SessionsContext.Provider value={{ sessions, isLoadingSessions, refreshSessions }}>
      {children}
    </SessionsContext.Provider>
  )
}

export function useSessions() {
  return useContext(SessionsContext)
}
