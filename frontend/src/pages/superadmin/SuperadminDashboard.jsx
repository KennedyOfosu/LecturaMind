import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../../components/ui/Spinner'
import './superadmin-dashboard.css'

const formatNumber = (value) => value == null ? '—' : new Intl.NumberFormat().format(Number(value) || 0)
const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
const formatTime = (value) => {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const glyphs = {
  students: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  lecturer: 'M12 3 2 8l10 5 10-5-10-5ZM4 10v6c4 3 12 3 16 0v-6M22 9v6',
  class: 'M3 21h18M5 21V5l7-3 7 3v16M9 9h1m4 0h1m-6 4h1m4 0h1m-5 8v-4h4v4',
  course: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17ZM4 4.5v17M8 6h8m-8 4h8',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  alert: 'M12 9v4m0 4h.01M10.3 3.86 1.82 18.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-2.86L13.7 3.86a2 2 0 0 0-3.4 0Z',
  account: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  plus: 'M12 5v14m-7-7h14',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

function Icon({ name, className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[name] || glyphs.account} /></svg>
}

function MetricCard({ label, value, note, icon, tone, onClick }) {
  return <button className={`ops-metric ops-tone-${tone}`} onClick={onClick}>
    <span className="ops-metric-icon"><Icon name={icon} /></span>
    <span className="ops-metric-label">{label}</span>
    <strong>{formatNumber(value)}</strong>
    <span className="ops-metric-note">{note}</span>
  </button>
}

function Panel({ title, subtitle, action, className = '', children }) {
  return <section className={`ops-panel ${className}`}>
    <header className="ops-panel-header">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </header>
    {children}
  </section>
}

function CoverageBar({ label, assigned, total }) {
  const available = assigned != null && total != null
  const percent = available && total > 0 ? Math.min(100, Math.max(0, Math.round((assigned / total) * 100))) : 0
  return <div className="ops-coverage-item">
    <div><span>{label}</span><strong>{available ? `${formatNumber(assigned)} / ${formatNumber(total)}` : 'Unavailable'}</strong></div>
    <div className="ops-progress" role="progressbar" aria-label={label} aria-valuenow={available ? percent : undefined} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${percent}%` }} /></div>
  </div>
}

export default function SuperadminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attentionOpen, setAttentionOpen] = useState(false)
  const [attentionPosition, setAttentionPosition] = useState(null)
  const attentionTriggerRef = useRef(null)
  const attentionPanelRef = useRef(null)
  const wasAttentionOpen = useRef(false)

  const closeAttention = useCallback(() => setAttentionOpen(false), [])
  const toggleAttention = () => {
    if (attentionOpen) return closeAttention()
    const bounds = attentionTriggerRef.current?.getBoundingClientRect()
    if (bounds) setAttentionPosition({ top: bounds.bottom + 8, right: Math.max(12, window.innerWidth - bounds.right) })
    setAttentionOpen(true)
  }

  useEffect(() => {
    if (!attentionOpen) {
      if (wasAttentionOpen.current) attentionTriggerRef.current?.focus()
      wasAttentionOpen.current = false
      return undefined
    }
    wasAttentionOpen.current = true
    attentionPanelRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAttention()
        return
      }
      if (event.key === 'Tab') {
        const focusable = attentionPanelRef.current?.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) {
          event.preventDefault()
          attentionPanelRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === attentionPanelRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const updatePosition = () => {
      const bounds = attentionTriggerRef.current?.getBoundingClientRect()
      if (bounds) setAttentionPosition({ top: bounds.bottom + 8, right: Math.max(12, window.innerWidth - bounds.right) })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [attentionOpen, closeAttention])

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await adminService.getDashboard()
      setData(response.data || {})
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error'
      const status = err?.response?.status
      console.error('[SuperadminDashboard] Load failed:', { status, msg, err })
      setError(`Failed to load overview (${status || 'network'}): ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') loadDashboard({ silent: true })
    }
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    const interval = window.setInterval(refreshVisible, 60000)
    return () => {
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.clearInterval(interval)
    }
  }, [loadDashboard])

  const metrics = useMemo(() => [
    { label: 'Students', value: data?.total_students, note: 'Registered learners', icon: 'students', tone: 'olive', path: '/superadmin/users?role=student' },
    { label: 'Lecturers', value: data?.total_lecturers, note: 'Teaching staff', icon: 'lecturer', tone: 'sage', path: '/superadmin/users?role=lecturer' },
    { label: 'Classes', value: data?.total_classrooms, note: 'Learning groups', icon: 'class', tone: 'sand', path: '/superadmin/classrooms' },
    { label: 'Courses', value: data?.total_courses, note: 'Academic courses', icon: 'course', tone: 'forest', path: '/superadmin/courses' },
  ], [data])

  const attentionItems = data?.attention || []
  const maximumStudents = Math.max(1, ...(data?.class_distribution || []).map((row) => Number(row.students) || 0))

  if (loading && !data) return <main className="school-ops-page"><div className="ops-loading"><Spinner /><span>Loading school operations…</span></div></main>
  if (error && !data) return <main className="school-ops-page"><div className="ops-error"><Icon name="alert" /><h1>Overview temporarily unavailable</h1><p>{error}</p><button onClick={() => loadDashboard()}>Try again</button></div></main>

  return <main className="school-ops-page">
    <header className="ops-page-header">
      <div>
        <div className="ops-eyebrow">SCHOOL OPERATIONS</div>
        <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0] || 'Administrator'}</h1>
        <p>{formatDate(data?.generated_at)} <span aria-hidden="true">·</span> A live view of enrollment and class coverage</p>
      </div>
      <div className="ops-header-actions">
        {data?.academic_period && <span className="ops-term"><span className="ops-status-dot" />{data.academic_period}</span>}
        <button className="ops-refresh" onClick={() => loadDashboard()} disabled={loading}><Icon name="clock" />{loading ? 'Updating' : 'Refresh'}</button>
        <button ref={attentionTriggerRef} type="button" className={`ops-notification${attentionOpen ? ' is-open' : ''}`} onClick={toggleAttention} aria-label="Administrative attention" aria-haspopup="dialog" aria-expanded={attentionOpen} aria-controls="ops-attention-popover" title="Administrative attention">
          <Icon name="alert" />{Number(data?.attention_count) > 0 && <span className="ops-notification-count">{formatNumber(data.attention_count)}</span>}
        </button>
      </div>
    </header>

    {error && <div className="ops-inline-notice" role="status">Showing the last loaded overview. <button onClick={() => loadDashboard()}>Retry</button></div>}
    {!!data?.data_warnings?.length && <div className="ops-inline-notice" role="status">Dashboard data needs attention: {data.data_warnings.join(', ')}. Counts depending on those records may be unavailable.</div>}

    <section className="ops-metrics" aria-label="School totals">
      {metrics.map((metric) => <MetricCard key={metric.label} {...metric} onClick={() => navigate(metric.path)} />)}
    </section>

    <div className="ops-content-grid">
      <Panel title="Class and enrollment overview" subtitle="Students assigned to each class and lecturer coverage" className="ops-classes-panel" action={<span className="ops-inline-stat">{formatNumber(data?.total_course_enrolments)} course enrollments</span>}>
        <div className="ops-class-head"><span>CLASS</span><span>STUDENT ENROLLMENT</span><span>LECTURERS</span></div>
        {data?.class_distribution?.length ? <div className="ops-class-list">{data.class_distribution.map((row) => <button className="ops-class-row" key={row.id} onClick={() => navigate(`/superadmin/users?role=student&classroom_id=${encodeURIComponent(row.id)}`)}>
          <span className="ops-class-name"><b>{row.name}</b><small>{row.code}{row.building ? ` · ${row.building}` : ''}</small></span>
          <span className="ops-enrollment-cell"><span className="ops-enrollment-bar"><i style={{ width: `${Math.round(((Number(row.students) || 0) / maximumStudents) * 100)}%` }} /></span><b>{formatNumber(row.students)}</b></span>
          <span className={`ops-lecturer-count ${row.lecturers === 0 ? 'is-missing' : ''}`}>{formatNumber(row.lecturers)}</span>
        </button>)}</div> : <p className="ops-empty">{data?.total_classrooms === 0 ? 'No classes have been created yet.' : 'Class distribution is unavailable.'}</p>}
      </Panel>

      <div className="ops-side-column">
        <Panel title="Quick actions" subtitle="Common school administration tasks" className="ops-actions-panel">
          <div className="ops-quick-actions">
            <button onClick={() => navigate('/superadmin/users', { state: { openCreateRole: 'lecturer' } })}><Icon name="plus" /><span><b>Add lecturer</b><small>Create a lecturer account</small></span><i>→</i></button>
            <button onClick={() => navigate('/superadmin/users', { state: { openCreateRole: 'student' } })}><Icon name="plus" /><span><b>Add student</b><small>Register a student</small></span><i>→</i></button>
            <button onClick={() => navigate('/superadmin/classrooms', { state: { openCreateClass: true } })}><Icon name="class" /><span><b>Create class</b><small>Add a learning group</small></span><i>→</i></button>
            <button onClick={() => navigate('/superadmin/users?role=lecturer&unassigned=true')}><Icon name="link" /><span><b>Assign lecturer to class</b><small>Review lecturers without a class</small></span><i>→</i></button>
            <button onClick={() => navigate('/superadmin/users')}><Icon name="people" /><span><b>Manage accounts</b><small>View students and staff</small></span><i>→</i></button>
          </div>
        </Panel>
        <Panel title="Class Assignment Progress" className="ops-assignment-progress-panel">
          <div className="ops-coverage-grid">
            <CoverageBar label="Students assigned to a class" assigned={data?.coverage?.students_assigned} total={data?.coverage?.total_students} />
            <CoverageBar label="Lecturers assigned to a class" assigned={data?.coverage?.lecturers_assigned} total={data?.coverage?.total_lecturers} />
            <CoverageBar label="Classes with a lecturer" assigned={data?.coverage?.classes_with_lecturers} total={data?.coverage?.total_classes} />
          </div>
        </Panel>
      </div>
    </div>
    <footer className="ops-footer">Overview refreshed {formatTime(data?.generated_at)}</footer>
    {attentionOpen && createPortal(<div className="ops-attention-layer">
      <button className="ops-attention-backdrop" type="button" aria-label="Close administrative attention" onClick={closeAttention} />
      <section ref={attentionPanelRef} id="ops-attention-popover" className="ops-attention-popover" role="dialog" aria-modal="true" aria-labelledby="ops-attention-title" tabIndex={-1} style={attentionPosition || undefined}>
        <header className="ops-attention-popover-header">
          <div><h2 id="ops-attention-title">Administrative attention</h2><p>Open a filtered list to review</p></div>
          {!!attentionItems.length && <span className="ops-open-count">{formatNumber(data?.attention_count)} open</span>}
        </header>
        <div className="ops-attention-list">
          {attentionItems.length ? attentionItems.map((item) => <button className="ops-attention-row" key={item.key} onClick={() => { closeAttention(); navigate(item.href) }}>
            <span className="ops-attention-mark"><Icon name="alert" /></span>
            <span className="ops-attention-label">{item.label}</span>
            <strong>{formatNumber(item.count)}</strong>
            <span className="ops-row-arrow" aria-hidden="true">→</span>
          </button>) : <p className="ops-empty"><span className="ops-attention-check" aria-hidden="true">✓</span>You're all caught up</p>}
        </div>
      </section>
    </div>, document.body)}
  </main>
}
