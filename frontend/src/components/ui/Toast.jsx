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
  loading: null,
}

const TYPE_STYLES = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  info:    'bg-navy',
  warning: 'bg-amber-500',
  loading: 'bg-gray-800',
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin shrink-0" width="15" height="15" fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

/* Individual toast item — handles its own slide-down entrance animation */
function ToastItem({ message, type }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm
                     font-medium shadow-lg w-80 transition-all duration-300
                     ${TYPE_STYLES[type]}
                     ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
      {type === 'loading' ? <SpinnerIcon /> : <span className="text-base shrink-0">{ICONS[type]}</span>}
      <span>{message}</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
    loading: (msg) => { const id = addToast(msg, 'loading', 0); return () => dismiss(id) },
  }

  /* Bridge for api.js interceptor (outside React context) */
  useEffect(() => {
    const handler = (e) => addToast(e.detail.message, e.detail.type)
    window.addEventListener('lecturamind:toast', handler)
    return () => window.removeEventListener('lecturamind:toast', handler)
  }, [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
                      flex flex-col items-center gap-2 pointer-events-none"
           style={{ marginTop: '0.5rem' }}>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
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
