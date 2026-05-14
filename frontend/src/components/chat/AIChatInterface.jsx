/**
 * AIChatInterface.jsx — Shared AI chat component used on both
 * the student dashboard (with course selector) and the course page AI tab.
 *
 * Props:
 *   courseId   — fixed course UUID (course page). Omit for dashboard mode.
 *   courses    — array of enrolled courses (needed for course selector in dashboard mode)
 *   onRefreshSessions — called after each AI reply so the sidebar stays current
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import api from '../../services/api'
import { chatService } from '../../services/chatService'
import { formatMessageTime } from '../../utils/formatDate'

/* ─── Markdown component map ────────────────────────────────────────────── */
const MD = {
  h1:     ({node, ...p}) => <h1     className="text-xl font-bold mt-4 mb-2"                           {...p} />,
  h2:     ({node, ...p}) => <h2     className="text-lg font-bold mt-3 mb-2"                            {...p} />,
  h3:     ({node, ...p}) => <h3     className="text-base font-semibold mt-2 mb-1"                      {...p} />,
  strong: ({node, ...p}) => <strong className="font-semibold"                                           {...p} />,
  ul:     ({node, ...p}) => <ul     className="list-disc list-inside my-2 space-y-1"                   {...p} />,
  ol:     ({node, ...p}) => <ol     className="list-decimal list-inside my-2 space-y-1"                {...p} />,
  li:     ({node, ...p}) => <li     className="ml-2"                                                   {...p} />,
  p:      ({node, ...p}) => <p      className="mb-2 leading-relaxed"                                   {...p} />,
  code:   ({node, inline, ...p}) => inline
    ? <code className="px-1 py-0.5 rounded text-sm font-mono bg-gray-100" {...p} />
    : <pre className="p-3 rounded-lg my-2 text-sm font-mono overflow-x-auto bg-gray-100"><code {...p} /></pre>,
}

/* ─── Copy button ───────────────────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(text) }
    catch {
      const el = document.createElement('textarea')
      el.value = text; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group inline-block">
      <button onClick={doCopy}
        className="flex items-center gap-1 text-xs opacity-50 hover:opacity-100 transition-opacity"
        aria-label={copied ? 'Copied!' : 'Copy'}>
        {copied ? (
          <><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span></>
        ) : (
          <><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg><span>Copy</span></>
        )}
      </button>
      <span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {copied ? 'Copied!' : 'Copy response'}
      </span>
    </div>
  )
}

/* ─── AI message — owns Simplify state ─────────────────────────────────── */
function AIMessage({ msg, courseId, msgId }) {
  const [simplified,    setSimplified]    = useState('')
  const [simpTs,        setSimpTs]        = useState('')
  const [isSimplifying, setIsSimplifying] = useState(false)

  const handleSimplify = async () => {
    if (!courseId) return
    setIsSimplifying(true); setSimplified('')
    try {
      const res = await chatService.simplifyMessage(msg.content, courseId)
      setSimplified(res.data.simplified || '')
      setSimpTs(res.data.timestamp || new Date().toISOString())
    } catch (err) {
      const msg2 = err?.response?.data?.error || 'Could not simplify. Please try again.'
      setSimplified(msg2)
      setSimpTs(new Date().toISOString())
    } finally { setIsSimplifying(false) }
  }

  return (
    <div id={msgId}>
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg width="16" height="13" viewBox="0 0 40 32" fill="none">
          <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xs font-semibold text-gray-500">LecturaMind AI</span>
      </div>

      {/* Response — no card, just text */}
      <div className="max-w-[85%] text-sm leading-relaxed text-gray-800">
        <ReactMarkdown components={MD}>{msg.content}</ReactMarkdown>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <CopyButton text={msg.content} />
        <button onClick={handleSimplify} disabled={isSimplifying || !courseId}
          className="flex items-center gap-1 text-xs opacity-50 hover:opacity-100 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
          title={courseId ? 'Get a simpler explanation' : 'Select a course first'}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <span>{isSimplifying ? 'Simplifying…' : 'Simplify'}</span>
        </button>
        <span className="text-xs text-gray-400">{formatMessageTime(msg.timestamp)}</span>
      </div>

      {/* Simplified version */}
      {(isSimplifying || simplified) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-400 mb-2 block">✦ Simplified version</span>
          {isSimplifying ? (
            <div className="flex gap-1 items-center h-5">
              {[0,1,2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          ) : (
            <>
              <div className="text-sm leading-relaxed text-gray-800">
                <ReactMarkdown components={MD}>{simplified}</ReactMarkdown>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <CopyButton text={simplified} />
                <span className="text-xs text-gray-400">{formatMessageTime(simpTs)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Course selector card (plus button popup) ──────────────────────────── */
function CourseSelectorCard({ courses, selectedCourseId, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl shadow-xl border z-50 overflow-hidden animate-slide-up"
      style={{ backgroundColor: '#fff', borderColor: '#D2D4D9' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: '#F0F0F2' }}>
        <p className="text-sm font-semibold text-gray-800">Select a course to ask about</p>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {courses.map((c) => (
          <button key={c.id} onClick={() => { onSelect(c); onClose() }}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{c.course_name}</p>
              <p className="text-xs text-gray-400">
                {[c.level && `Level ${c.level}`, c.programme].filter(Boolean).join(' · ')}
              </p>
            </div>
            {selectedCourseId === c.id && (
              <svg className="h-4 w-4 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function AIChatInterface({
  courseId: fixedCourseId,  // set on course page; undefined on dashboard
  courses = [],              // for course selector on dashboard
  onRefreshSessions,         // called after each AI reply
  greeting,                  // optional greeting element rendered above messages
}) {
  const [selectedCourse,  setSelectedCourse]  = useState(null)
  const [messages,        setMessages]        = useState([])
  const [query,           setQuery]           = useState('')
  const [isTyping,        setIsTyping]        = useState(false)
  const [showSelector,    setShowSelector]    = useState(false)
  const bottomRef = useRef(null)

  // Resolve the active course ID
  const activeCourseId = fixedCourseId || selectedCourse?.id

  // Load history when course is known
  useEffect(() => {
    if (!activeCourseId) return
    setMessages([])
    api.get(`/api/chatbot/history/${activeCourseId}`)
      .then((res) => {
        const msgs = []
        res.data.forEach((row) => {
          msgs.push({ id: `${row.id}-q`, role: 'user',  content: row.query,    timestamp: row.timestamp })
          msgs.push({ id: `${row.id}-r`, role: 'ai',    content: row.response, timestamp: row.timestamp })
        })
        setMessages(msgs)
      })
      .catch(() => {})
  }, [activeCourseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = useCallback(async (e) => {
    e?.preventDefault()
    const text = query.trim()
    if (!text || !activeCourseId || isTyping) return

    const sentAt = new Date().toISOString()
    const userMsgId = `local-${Date.now()}-q`
    setMessages((p) => [...p, { id: userMsgId, role: 'user', content: text, timestamp: sentAt }])
    setQuery('')
    setIsTyping(true)

    try {
      const res = await api.post('/api/chatbot/query', { course_id: activeCourseId, query: text })
      setMessages((p) => [...p, {
        id:        `local-${Date.now()}-r`,
        role:      'ai',
        content:   res.data.response,
        timestamp: res.data.timestamp || new Date().toISOString(),
      }])
      onRefreshSessions?.()
    } catch {
      setMessages((p) => [...p, {
        id:        `local-${Date.now()}-e`,
        role:      'ai',
        content:   "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      }])
    } finally { setIsTyping(false) }
  }, [query, activeCourseId, isTyping, onRefreshSessions])

  // Course name for display
  const courseName = fixedCourseId
    ? courses.find((c) => c.id === fixedCourseId)?.course_name
    : selectedCourse?.course_name

  const dashboardMode = !fixedCourseId

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Greeting area (only in dashboard mode) */}
      {greeting}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {messages.length === 0 && !isTyping && !greeting && (
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-gray-400 text-sm">
              {activeCourseId ? `Ask me anything about ${courseName || 'this course'}` : 'Select a course to start chatting'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'user' ? (
              <>
                <div className="max-w-[78%] px-4 py-3 rounded-xl text-sm leading-relaxed text-white"
                  style={{ backgroundColor: '#111' }}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-400 mt-1 px-1">{formatMessageTime(msg.timestamp)}</span>
              </>
            ) : (
              <AIMessage msg={msg} courseId={activeCourseId} msgId={msg.id} />
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0,1,2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
            <span className="text-xs text-gray-400">LecturaMind AI is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-6 pb-6 shrink-0">
        <form onSubmit={handleSend}
          className="relative max-w-2xl mx-auto rounded-2xl shadow-sm overflow-visible"
          style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>

          {/* Course selector popup */}
          {showSelector && dashboardMode && (
            <CourseSelectorCard
              courses={courses}
              selectedCourseId={selectedCourse?.id}
              onSelect={setSelectedCourse}
              onClose={() => setShowSelector(false)}
            />
          )}

          {/* Selected course pill (dashboard mode) */}
          {dashboardMode && selectedCourse && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b" style={{ borderColor: '#F0F0F2' }}>
              <span className="text-xs text-gray-400">Course:</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#111' }}>
                {selectedCourse.course_code || selectedCourse.course_name}
              </span>
              <button type="button" onClick={() => setSelectedCourse(null)}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto">✕</button>
            </div>
          )}

          <div className="flex items-center px-3 py-3 gap-2">
            {/* Plus button (dashboard mode only) */}
            {dashboardMode && (
              <button type="button"
                onClick={() => setShowSelector((v) => !v)}
                title="Select a course"
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-gray-100"
                style={{ color: '#374151' }}>
                {selectedCourse ? (
                  <span className="text-xs font-bold">{selectedCourse.course_code?.[0] || selectedCourse.course_name?.[0]}</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                )}
              </button>
            )}

            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={activeCourseId
                ? `Ask about ${courseName || 'this course'}…`
                : dashboardMode ? 'Click ⊕ to pick a course, then ask a question…' : 'Ask a question…'}
              disabled={isTyping}
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent disabled:opacity-50"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)} />

            <div className="relative group">
              <button type="submit"
                disabled={!activeCourseId || !query.trim() || isTyping}
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
                style={{ backgroundColor: '#111' }}>
                {isTyping ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
              {!activeCourseId && (
                <span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Select a course first
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
