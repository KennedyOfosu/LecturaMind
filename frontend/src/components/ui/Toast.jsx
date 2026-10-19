import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'

const ToastContext = createContext(null)

let toastId = 0

/* ── Gentle notification chime via Web Audio API ── */
let audioCtx = null
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.06, now + i * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.25)
    })
  } catch {
    /* audio not supported — silent fallback */
  }
}

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

const EXIT_DURATION = 400

function ToastItem({ id, message, type, onRemove, duration }) {
  const [exiting, setExiting] = useState(false)
  const played = useRef(false)
  const timerRef = useRef(null)
  const exitTimerRef = useRef(null)

  useEffect(() => {
    if (!played.current) {
      playNotificationSound()
      played.current = true
    }
    if (duration > 0) {
      timerRef.current = setTimeout(() => setExiting(true), duration)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [duration])

  useEffect(() => {
    if (exiting) {
      exitTimerRef.current = setTimeout(() => onRemove(id), EXIT_DURATION)
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [exiting, id, onRemove])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm
                     font-medium shadow-lg w-80
                     ${TYPE_STYLES[type]}
                     ${exiting ? 'animate-[toast-exit_0.4s_ease-out_forwards]' : 'animate-[toast-enter_0.4s_ease-out_forwards]'}`}>
      {type === 'loading' ? <SpinnerIcon /> : <span className="text-base shrink-0">{ICONS[type]}</span>}
      <span>{message}</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useMemo(() => ({
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
    loading: (msg) => { const id = addToast(msg, 'loading', 0); return () => removeToast(id) },
  }), [addToast, removeToast])

  useEffect(() => {
    const handler = (e) => addToast(e.detail.message, e.detail.type)
    window.addEventListener('lecturamind:toast', handler)
    return () => window.removeEventListener('lecturamind:toast', handler)
  }, [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[99999]
                       flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem
              id={t.id}
              message={t.message}
              type={t.type}
              duration={t.duration}
              onRemove={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
