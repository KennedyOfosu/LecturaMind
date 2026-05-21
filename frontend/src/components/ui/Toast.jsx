/**
 * Toast.jsx — Notification toast system.
 * Usage: import { useToast } from this file; call toast.success() / toast.error().
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

let toastId = 0

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}

const TYPE_STYLES = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  info:    'bg-navy',
  warning: 'bg-amber-500',
}

/* Individual toast item — handles its own slide-down entrance animation */
function ToastItem({ message, type }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm
                     font-medium shadow-lg w-80 transition-all duration-300
                     ${TYPE_STYLES[type]}
                     ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
      <span className="text-base">{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* CHANGE 1: centre-top, below webcam area */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
                      flex flex-col items-center gap-2 pointer-events-none"
           style={{ marginTop: '0.5rem' }}>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            {/* CHANGE 2 & 3: slide-down animation + w-80 handled inside ToastItem */}
            <ToastItem message={t.message} type={t.type} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
