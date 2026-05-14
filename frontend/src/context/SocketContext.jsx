/**
 * SocketContext.jsx — Global Socket.IO connection state.
 * Uses React state (not just a ref) so consumers re-render when the socket connects.
 */

import { createContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'

export const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('lm_token')

    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
        setConnected(false)
      }
      return
    }

    const socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['polling', 'websocket'],
    })

    socketInstance.on('connect', () => {
      setConnected(true)
      setSocket(socketInstance) // expose only after confirmed connected
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
      setSocket(null)
    })

    socketRef.current = socketInstance

    return () => {
      socketInstance.disconnect()
      socketRef.current = null
      setSocket(null)
      setConnected(false)
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}
