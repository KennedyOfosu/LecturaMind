/**
 * CourseManager.jsx — Gradebook-style course analytics dashboard.
 * Matches the reference UI: weighted assessment columns, grade histogram
 * with Bars/Curve toggle, performance-by-assessment panel, sortable
 * gradebook, and a slide-in student detail panel.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, SEMESTERS } from '../../utils/constants'

/* ─────────────── constants ──────────────────────────────────── */
const LEVELS       = [100, 200, 300, 400]
const LEVEL_COLORS = { 100:'#6366f1', 200:'#0d9488', 300:'#f59e0b', 400:'#8b5cf6' }

const ASSESS_TYPES   = ['Quiz','Assignment','Mid-Sem','Presentation','End-Sem 1','End-Sem 2']
const ASSESS_WEIGHTS = { 'Quiz':10,'Assignment':15,'Mid-Sem':25,'Presentation':15,'End-Sem 1':15,'End-Sem 2':20 }
const ASSESS_SHORT   = { 'Quiz':'Quiz','Assignment':'Assign','Mid-Sem':'Mid-Sem','Presentation':'Present','End-Sem 1':'ES-1','End-Sem 2':'ES-2' }
const HIST_BUCKETS   = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-99']

/* ─────────────── pure helpers ───────────────────────────────── */
const pct      = (s, m) => (!m ? 0 : Math.round((s / m) * 100))
const avg      = (arr)  => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null
const grade    = (v)    => v==null?'—': v>=85?'A': v>=70?'B': v>=60?'C': v>=50?'D':'F'
const risk     = (v)    => v==null?'warn': v>=65?'ok': v>=50?'warn':'bad'
const initials = (n='') => n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'
const fmtW     = (v)    => v==null?'—': Number.isInteger(v)?`${v}`:`${v.toFixed(1)}`

function binIndex(v) { return Math.min(Math.floor(v / 10), 9) }

/* weighted total out of 100 (one decimal) */
function weightedScore(typeAvgs, activeTypes) {
  let total = 0, wSum = 0
  activeTypes.forEach(t => {
    const w = ASSESS_WEIGHTS[t] || 0
    const v = typeAvgs[t]
    if (v != null && w > 0) { total += v * w / 100; wSum += w }
  })
  if (!wSum) return null
  const raw = (total / wSum) * 100
  return Math.round(raw * 10) / 10   // one decimal
}

/* ─────────────── export helpers ────────────────────────────── */
function exportGradebookCSV(course, students, marksMap, activeTypes, user) {
  const rows = students.map(s => {
    const marks = marksMap[s.id] || []
    const typeAvgs = {}
    activeTypes.forEach(t => {
      const tm = marks.filter(m => m.assessment_type === t)
      typeAvgs[t] = tm.length ? Math.round(tm.reduce((a,b)=>a+pct(b.score,b.max_score),0)/tm.length) : null
    })
    const ws = weightedScore(typeAvgs, activeTypes)
    const g  = grade(ws)
    return [s.full_name, s.user_id_number||'', ...activeTypes.map(t=>typeAvgs[t]!=null?`${typeAvgs[t]}%`:'—'), ws!=null?fmtW(ws):'—', g]
  })
  const headers = ['Student','ID',...activeTypes,'Weighted','Grade']
  const meta = [
    [`Course: ${course.course_name} (${course.course_code})`],
    [`Lecturer: ${user?.full_name||''}`],
    [`Exported: ${new Date().toLocaleDateString()}`],
    [`Weights: ${activeTypes.map(t=>`${t}=${ASSESS_WEIGHTS[t]||0}`).join(', ')}`],
    []
  ]
  const csv = [...meta, headers, ...rows].map(r=>r.join(',')).join('\n')
  const a = Object.assign(document.createElement('a'),{
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download:`${course.course_code}_gradebook.csv`
  })
  a.click()
}

function exportStudentReport(course, student, marks, activeTypes, user) {
  const typeAvgs = {}
  activeTypes.forEach(t => {
    const tm = marks.filter(m => m.assessment_type === t)
    typeAvgs[t] = tm.length ? Math.round(tm.reduce((a,b)=>a+pct(b.score,b.max_score),0)/tm.length) : null
  })
  const ws = weightedScore(typeAvgs, activeTypes)
  const g  = grade(ws)
  const lines = [
    'STUDENT PERFORMANCE REPORT','===========================',
    `Student:  ${student.full_name}`, `ID:       ${student.user_id_number||'—'}`,
    `Course:   ${course.course_name} (${course.course_code})`,
    `Lecturer: ${user?.full_name||'—'}`,
    `Date:     ${new Date().toLocaleDateString()}`, '',
    'ASSESSMENT BREAKDOWN (with weights)','------------------------------------',
    ...activeTypes.map(t=>`${t.padEnd(16)}: ${typeAvgs[t]!=null?`${typeAvgs[t]}%`:'—'}  (W ${ASSESS_WEIGHTS[t]||0})`),
    '',
    `Weighted Total  : ${ws!=null?fmtW(ws):'—'} / 100`,
    `Grade           : ${g}`,
  ]
  const a = Object.assign(document.createElement('a'),{
    href: URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'})),
    download:`${student.user_id_number||student.full_name.replace(/\s+/g,'_')}_report.txt`
  })
  a.click()
}

/* ─────────────── student detail side panel ─────────────────── */
function StudentDetailPanel({ student, marks, activeTypes, course, user, onClose }) {
  const typeAvgs = {}
  activeTypes.forEach(t => {
    const tm = marks.filter(m => m.assessment_type === t)
    typeAvgs[t] = tm.length ? Math.round(tm.reduce((a,b)=>a+pct(b.score,b.max_score),0)/tm.length) : null
  })
  const ws = weightedScore(typeAvgs, activeTypes)
  const g  = grade(ws)
  const statusLevel = ws==null?'warn': ws>=65?'ok': ws>=50?'warn':'bad'
  const stMap = {
    ok:   { label:'On Track', bg:'bg-emerald-50', text:'text-emerald-700', dot:'bg-emerald-500' },
    warn: { label:'Watch',    bg:'bg-amber-50',   text:'text-amber-700',   dot:'bg-amber-400'   },
    bad:  { label:'At Risk',  bg:'bg-red-50',     text:'text-red-700',     dot:'bg-red-500'     },
  }
  const st = stMap[statusLevel]

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm h-full bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">
              {initials(student.full_name)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{student.full_name}</p>
              <p className="font-mono text-xs text-gray-400">{student.user_id_number||'—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Summary row */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Weighted Total</p>
            <p className="text-3xl font-bold text-gray-900">{ws!=null?fmtW(ws):'—'}<span className="text-base font-normal text-gray-400">/100</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Grade</p>
            <span className={`text-2xl font-bold ${g==='A'?'text-emerald-600':g==='B'?'text-blue-600':g==='C'?'text-amber-600':g==='D'?'text-orange-600':g==='F'?'text-red-600':'text-gray-400'}`}>
              {g}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
          </div>
        </div>

        {/* Assessment breakdown */}
        <div className="px-5 py-4 flex-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Assessment Breakdown</p>
          {!activeTypes.length
            ? <p className="text-sm text-gray-400">No marks recorded yet.</p>
            : (
              <div className="flex flex-col gap-4">
                {activeTypes.map(t => {
                  const v = typeAvgs[t]
                  const w = ASSESS_WEIGHTS[t] || 0
                  const barColor = v==null?'#e5e7eb': v>=70?'#10b981': v>=50?'#f59e0b':'#ef4444'
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{t}</span>
                          <span className="text-[10px] font-mono text-gray-300">W {w}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-gray-900">
                          {v!=null?`${v}%`:'—'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width:v!=null?`${v}%`:'0%', backgroundColor:barColor }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* Course context */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
          <p>{course?.course_name} · {course?.course_code}</p>
        </div>

        {/* Download */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => exportStudentReport(course, student, marks, activeTypes, user)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Report
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── SVG histogram ─────────────────────────────── */
function GradeHistogram({ studentAverages, mode = 'bars' }) {
  const bins = Array(10).fill(0)
  studentAverages.forEach(v => { if (v != null) bins[binIndex(v)]++ })
  const maxBin = Math.max(...bins, 1)
  const W = 480, H = 180, padL = 28, padB = 32, padT = 20, padR = 8
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW   = Math.floor(chartW / 10) - 4

  const yTicks = [0, Math.ceil(maxBin / 2), maxBin]

  /* midpoints for curve overlay */
  const midpoints = bins.map((cnt, i) => ({
    x: padL + i * (chartW / 10) + barW / 2 + 2,
    y: padT + chartH - (cnt / maxBin) * chartH,
  }))

  const curvePath = midpoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = midpoints[i - 1]
    const cpx = (prev.x + p.x) / 2
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
  }, '')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {/* gridlines + y-labels */}
      {yTicks.map(v => {
        const y = padT + chartH - (v / maxBin) * chartH
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#f3f4f6" strokeWidth={1}/>
            <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
          </g>
        )
      })}

      {/* bars */}
      {bins.map((cnt, i) => {
        const bh     = (cnt / maxBin) * chartH
        const x      = padL + i * (chartW / 10) + 2
        const y      = padT + chartH - bh
        const labelY = padT + chartH + 14
        return (
          <g key={i}>
            <rect x={x} y={cnt===0?padT+chartH-1:y} width={barW}
              height={Math.max(bh,1)} fill="#e11d48" rx={3}
              opacity={cnt===0?0.12:(mode==='curve'?0.25:1)}/>
            {cnt > 0 && mode === 'bars' && (
              <text x={x+barW/2} y={y-4} textAnchor="middle" fontSize={11}
                fontWeight="600" fill="#374151">{cnt}</text>
            )}
            <text x={x+barW/2} y={labelY} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {HIST_BUCKETS[i]}
            </text>
          </g>
        )
      })}

      {/* curve overlay */}
      {mode === 'curve' && (
        <>
          <path d={curvePath} fill="none" stroke="#e11d48" strokeWidth={2.5} strokeLinejoin="round"/>
          {midpoints.map((p, i) => bins[i] > 0 && (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4} fill="#e11d48"/>
              <text x={p.x} y={p.y-8} textAnchor="middle" fontSize={11} fontWeight="600" fill="#374151">
                {bins[i]}
              </text>
            </g>
          ))}
        </>
      )}

      {/* x baseline */}
      <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke="#e5e7eb" strokeWidth={1}/>
    </svg>
  )
}

/* ─────────────── grade legend pills ─────────────────────────── */
const GRADE_BUCKETS = [
  { key:'A', label:'A · 85+',   color:'#10b981' },
  { key:'B', label:'B · 70-84', color:'#3b82f6' },
  { key:'C', label:'C · 60-69', color:'#f59e0b' },
  { key:'D', label:'D · 50-59', color:'#f97316' },
  { key:'F', label:'F · <50',   color:'#e11d48' },
]
function gradeDist(avgs) {
  const d = {A:0,B:0,C:0,D:0,F:0}
  avgs.forEach(v => { if(v!=null) d[grade(v)]++ })
  return d
}

/* ─────────────── horizontal perf bars ───────────────────────── */
function AssessmentPerf({ typeAverages }) {
  if (!typeAverages.length) return (
    <p className="text-xs text-gray-400 py-8 text-center">No marks recorded yet</p>
  )
  return (
    <div className="flex flex-col" style={{ gap: 20 }}>
      {typeAverages.map(({ type, avg: v, weight }) => (
        <div key={type} className="flex items-center gap-3">
          <span
            className="text-xs font-semibold text-gray-500 shrink-0 px-2 py-0.5 rounded border border-gray-200 bg-gray-50"
            style={{ minWidth: 52, textAlign: 'center' }}
          >
            {ASSESS_SHORT[type] || type}
          </span>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: v > 0 ? `${v}%` : '2%' }}/>
          </div>
          <span className="text-sm font-bold tabular-nums text-gray-800 w-9 text-right shrink-0">
            {v}
          </span>
          {/* delta placeholder — to be replaced when historical cohort data is available */}
          <span className="text-[11px] w-12 text-right shrink-0 font-medium text-gray-300">
            — —
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── score cell ─────────────────────────────────── */
function ScoreCell({ v }) {
  if (v == null) return <span className="text-gray-300 text-xs">—</span>
  const cls = v >= 85 ? 'bg-emerald-50 text-emerald-700'
            : v >= 70 ? 'bg-blue-50 text-blue-700'
            : v >= 60 ? 'bg-amber-50 text-amber-700'
            : v >= 50 ? 'bg-orange-50 text-orange-700'
            : 'bg-red-50 text-red-600'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums ${cls}`}>
      {v}
    </span>
  )
}

/* ─────────────── risk pill ──────────────────────────────────── */
function RiskPill({ level }) {
  const map = {
    ok:   { label:'on track', dot:'bg-emerald-500', cls:'bg-emerald-50 text-emerald-700 border-emerald-200' },
    warn: { label:'watch',    dot:'bg-amber-400',   cls:'bg-amber-50  text-amber-700  border-amber-200'  },
    bad:  { label:'at risk',  dot:'bg-red-500',     cls:'bg-red-50    text-red-700    border-red-200'    },
  }
  const m = map[level] || map.warn
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`}/>
      {m.label}
    </span>
  )
}

/* ─────────────── gradebook table ────────────────────────────── */
function Gradebook({ students, marksMap, activeTypes, onSelectStudent }) {
  const [sort, setSort] = useState({ key:'weighted', dir:'desc' })

  const rows = useMemo(() => {
    return students.map(s => {
      const marks = marksMap[s.id] || []
      const typeAvgs = {}
      activeTypes.forEach(t => {
        const tm = marks.filter(m => m.assessment_type === t)
        typeAvgs[t] = tm.length ? avg(tm.map(m => pct(m.score, m.max_score))) : null
      })
      const ws   = weightedScore(typeAvgs, activeTypes)
      return { student: s, typeAvgs, weighted: ws, grade: grade(ws), risk: risk(ws) }
    })
  }, [students, marksMap, activeTypes])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = sort.key === 'name'     ? a.student.full_name
             : sort.key === 'weighted' ? (a.weighted ?? -1)
             : sort.key === 'grade'    ? ({'A':5,'B':4,'C':3,'D':2,'F':1,'—':0})[a.grade]
             : (a.typeAvgs[sort.key] ?? -1)
      let bv = sort.key === 'name'     ? b.student.full_name
             : sort.key === 'weighted' ? (b.weighted ?? -1)
             : sort.key === 'grade'    ? ({'A':5,'B':4,'C':3,'D':2,'F':1,'—':0})[b.grade]
             : (b.typeAvgs[sort.key] ?? -1)
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return av < bv ? (sort.dir==='asc'?-1:1) : av > bv ? (sort.dir==='asc'?1:-1) : 0
    })
  }, [rows, sort])

  const toggleSort = k =>
    setSort(s => s.key===k ? {key:k,dir:s.dir==='asc'?'desc':'asc'} : {key:k,dir:'desc'})

  /* sortable th */
  const Th = ({ label, sub, k, right=false }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2.5 select-none cursor-pointer hover:text-gray-700 whitespace-nowrap
        ${right?'text-right':'text-left'}`}
    >
      <div className={`flex flex-col ${right?'items-end':'items-start'}`}>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          {label}
          <span className="ml-1 text-gray-300 normal-case">
            {sort.key===k ? (sort.dir==='desc'?'↓':'↑') : '↕'}
          </span>
        </span>
        {sub && <span className="text-[9px] font-mono text-gray-300 normal-case tracking-normal">{sub}</span>}
      </div>
    </th>
  )

  /* class averages footer */
  const classTypeAvgs = {}
  activeTypes.forEach(t => {
    const vals = rows.map(r=>r.typeAvgs[t]).filter(v=>v!=null)
    classTypeAvgs[t] = avg(vals)
  })
  const classWeighted = (() => {
    if (!rows.length) return null
    const vals = rows.map(r=>r.weighted).filter(v=>v!=null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10) / 10
  })()

  if (!students.length) return (
    <p className="text-sm text-gray-400 text-center py-10">No students enrolled yet.</p>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            <Th label="Student" k="name" />
            <th className="px-3 py-2.5 text-left">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">ID</span>
            </th>
            {activeTypes.map(t => (
              <Th key={t} label={ASSESS_SHORT[t]||t} sub={`W ${ASSESS_WEIGHTS[t]||0}`} k={t} right/>
            ))}
            <Th label="Weighted" sub="/ 100" k="weighted" right/>
            <Th label="Grade" k="grade"/>
            <Th label="Status" k="risk"/>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => (
            <tr key={r.student.id}
              onClick={() => onSelectStudent?.(r.student)}
              className="border-b border-gray-50 hover:bg-gray-100/80 transition-colors cursor-pointer"
              style={{ borderBottom: idx===sorted.length-1?'none':'1px solid #f9fafb' }}
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                    {initials(r.student.full_name)}
                  </div>
                  <span className="font-medium text-gray-900 whitespace-nowrap">{r.student.full_name}</span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-xs text-gray-400">{r.student.user_id_number || '—'}</span>
              </td>
              {activeTypes.map(t => (
                <td key={t} className="px-3 py-2.5 text-right">
                  <ScoreCell v={r.typeAvgs[t]} />
                </td>
              ))}
              <td className="px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums text-gray-800 text-sm">
                  {r.weighted != null ? fmtW(r.weighted) : '—'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`font-bold text-sm px-2 py-0.5 rounded ${
                  r.grade==='A'?'text-emerald-700 bg-emerald-50':
                  r.grade==='B'?'text-blue-700 bg-blue-50':
                  r.grade==='C'?'text-amber-700 bg-amber-50':
                  r.grade==='D'?'text-orange-700 bg-orange-50':
                  r.grade==='F'?'text-red-700 bg-red-50':
                  'text-gray-400'
                }`}>{r.grade}</span>
              </td>
              <td className="px-3 py-2.5">
                <RiskPill level={r.risk} />
              </td>
            </tr>
          ))}

          {/* Class average footer */}
          <tr className="bg-gray-50/80 border-t border-gray-200">
            <td className="px-3 py-2.5 text-xs font-semibold text-gray-500">Class average</td>
            <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">n={sorted.length}</td>
            {activeTypes.map(t => (
              <td key={t} className="px-3 py-2.5 text-right">
                <span className="text-xs font-semibold tabular-nums text-gray-500">
                  {classTypeAvgs[t]!=null?`${classTypeAvgs[t]}%`:'—'}
                </span>
              </td>
            ))}
            <td className="px-3 py-2.5 text-right">
              <span className="text-xs font-bold text-gray-700">
                {classWeighted!=null?fmtW(classWeighted):'—'}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <span className="text-xs font-semibold text-gray-500">{grade(classWeighted)}</span>
            </td>
            <td/>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────── course form (create / edit) ─────────────────── */
function CourseForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    course_name:'', course_code:'', description:'',
    credits:'', schedule_days:'', schedule_time:'', room:'',
    level: initial.level ?? '',
    ...initial,
    level: initial.level ?? '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.course_name.trim()) e.course_name = 'Required'
    if (!form.course_code.trim()) e.course_code = 'Required'
    if (!form.level)               e.level       = 'Select a level'
    setErrors(e); return !Object.keys(e).length
  }
  const handleSubmit = e => { e.preventDefault(); if (validate()) onSubmit({...form, level:parseInt(form.level)}) }
  const f  = k => ({ value: form[k]??'', onChange: e => setForm({...form,[k]:e.target.value}) })
  const inp = k => `w-full px-3.5 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${errors[k]?'border-red-400 bg-red-50':'border-gray-200 bg-white'}`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {[
        { label:'Course Name', key:'course_name', placeholder:'Introduction to Computing' },
        { label:'Course Code', key:'course_code', placeholder:'ICT 101' },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
          <input {...f(key)} placeholder={placeholder} className={inp(key)} />
          {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
        </div>
      ))}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Academic Level</label>
        <select {...f('level')} className={inp('level')}>
          <option value="">Select level…</option>
          {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
        </select>
        {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level}</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description / Department</label>
        <textarea {...f('description')} rows={2} placeholder="e.g. Information Security, Computer Networks…"
          className="w-full px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Credits</label>
          <input {...f('credits')} placeholder="e.g. 3" className={inp('credits')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Room</label>
          <input {...f('room')} placeholder="e.g. Lab-7" className={inp('room')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Schedule Days</label>
          <input {...f('schedule_days')} placeholder="e.g. Mon · Wed" className={inp('schedule_days')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Schedule Time</label>
          <input {...f('schedule_time')} placeholder="e.g. 14:00–16:00" className={inp('schedule_time')} />
        </div>
      </div>
      <Button type="submit" variant="teal" loading={loading} className="w-full mt-1">
        {initial.id ? 'Save Changes' : 'Create Course'}
      </Button>
    </form>
  )
}

/* ─────────────── main page ──────────────────────────────────── */
export default function CourseManager() {
  const toast = useToast()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const gradebookRef  = useRef(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [chartMode, setChartMode] = useState('bars')  // 'bars' | 'curve'
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* course list */
  const [courses,     setCourses]     = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId,  setSelectedId]  = useState(null)

  /* analytics data */
  const [students,    setStudents]    = useState([])
  const [marksMap,    setMarksMap]    = useState({})
  const [loadingData, setLoadingData] = useState(false)

  /* CRUD modals */
  const [modal,        setModal]       = useState({ type:null, course:null })
  const [actionLoad,   setActionLoad]  = useState(false)
  const [deleteTarget, setDeleteTarget]= useState(null)
  const [justCreated,  setJustCreated] = useState(null)
  const [assignForm,   setAssignForm]  = useState({ programme:'', level:'', semester:'', academic_year:'' })
  const [savingAssign, setSavingAssign]= useState(false)

  /* ── fetch course list ── */
  const fetchCourses = useCallback(() => {
    setLoadingList(true)
    courseService.getMyCourses()
      .then(r => {
        setCourses(r.data || [])
        if (!selectedId && r.data?.length) setSelectedId(r.data[0].id)
      })
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  /* ── fetch students + marks ── */
  const loadAnalytics = useCallback(async (courseId) => {
    if (!courseId) return
    setLoadingData(true)
    setStudents([]); setMarksMap({})
    try {
      const sRes  = await api.get(`/api/courses/${courseId}/students`)
      const sList = sRes.data || []
      setStudents(sList)
      const results = await Promise.all(
        sList.map(s =>
          api.get(`/api/marks/student/${s.id}/course/${courseId}`)
            .then(r => ({ id:s.id, marks:r.data||[] }))
            .catch(()  => ({ id:s.id, marks:[] }))
        )
      )
      const map = {}
      results.forEach(({ id, marks }) => { map[id] = marks })
      setMarksMap(map)
    } catch { toast.error('Failed to load course data') }
    finally { setLoadingData(false) }
  }, [])

  useEffect(() => { loadAnalytics(selectedId) }, [selectedId, loadAnalytics])

  /* URL param sync */
  useEffect(() => {
    const p = searchParams.get('course')
    if (p) setSelectedId(p)
  }, [searchParams])

  useEffect(() => {
    if (selectedId) setSearchParams({ course: selectedId }, { replace: true })
  }, [selectedId])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setModal({ type:'create' })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  /* ── derived analytics ── */
  const selectedCourse = courses.find(c => c.id === selectedId) || null

  const allMarks = useMemo(() => Object.values(marksMap).flat(), [marksMap])

  /* always show all assessment types — show 0 when no marks exist */
  const activeTypes = ASSESS_TYPES

  /* weighted average per student */
  const studentWeightedAvgs = useMemo(() =>
    students.map(s => {
      const m = marksMap[s.id] || []
      if (!m.length) return null
      const typeAvgs = {}
      activeTypes.forEach(t => {
        const tm = m.filter(mk => mk.assessment_type === t)
        typeAvgs[t] = tm.length ? avg(tm.map(mk => pct(mk.score, mk.max_score))) : null
      })
      return weightedScore(typeAvgs, activeTypes)
    }),
  [students, marksMap, activeTypes])

  const classAvg  = (() => {
    const vals = studentWeightedAvgs.filter(v=>v!=null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10) / 10
  })()
  const passRate  = students.length
    ? Math.round((studentWeightedAvgs.filter(v=>v!=null&&v>=50).length/students.length)*100)
    : 0
  const atRisk    = studentWeightedAvgs.filter(v=>v!=null&&v<50).length
  const onWatch   = studentWeightedAvgs.filter(v=>v!=null&&v>=50&&v<65).length

  /* class average per type — include weight */
  const typeAverages = useMemo(() =>
    activeTypes.map(t => {
      const vals = allMarks.filter(m=>m.assessment_type===t).map(m=>pct(m.score,m.max_score))
      return { type:t, avg:avg(vals)??0, weight:ASSESS_WEIGHTS[t]||0 }
    }),
  [activeTypes, allMarks])

  const dist = gradeDist(studentWeightedAvgs)

  /* ── CRUD handlers ── */
  const handleCreate = async (form) => {
    setActionLoad(true)
    try {
      const res = await courseService.create(form)
      toast.success('Course created!')
      setJustCreated(res.data)
      setAssignForm({ programme:'', level:form.level||'', semester:'', academic_year:'' })
      setModal({ type:'assign' })
      fetchCourses()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create course') }
    finally { setActionLoad(false) }
  }

  const handleSaveAssignment = async () => {
    if (!assignForm.programme || !assignForm.level) { toast.error('Programme and level required'); return }
    setSavingAssign(true)
    try {
      const res = await api.post('/api/assignments/create', {
        course_id:     justCreated.id,
        programme:     assignForm.programme,
        level:         parseInt(assignForm.level),
        semester:      assignForm.semester || null,
        academic_year: assignForm.academic_year || null,
      })
      toast.success(res.data.message || 'Assignment saved!')
      setModal({ type:null }); setJustCreated(null)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save assignment') }
    finally { setSavingAssign(false) }
  }
  const skipAssign = () => { setModal({ type:null }); setJustCreated(null) }

  const handleEdit = async (form) => {
    setActionLoad(true)
    try {
      await courseService.update(modal.course.id, form)
      toast.success('Course updated!')
      setModal({ type:null })
      fetchCourses()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setActionLoad(false) }
  }

  const handleDelete = async () => {
    setActionLoad(true)
    try {
      await courseService.delete(deleteTarget.id)
      toast.success('Course deleted')
      setDeleteTarget(null)
      const remaining = courses.filter(c=>c.id!==deleteTarget.id)
      setSelectedId(remaining[0]?.id || null)
      fetchCourses()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete') }
    finally { setActionLoad(false) }
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*  RENDER                                                        */
  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex -mx-8 -mt-8" style={{ minHeight:'calc(100vh - 64px)' }}>

      <div className="flex-1 min-w-0 flex flex-col overflow-auto bg-gray-50/60">

        {!selectedCourse ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-12">
            <div className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm">📊</div>
            <p className="font-semibold text-gray-600">Select a course from the sidebar</p>
            <p className="text-sm text-gray-400">Analytics, gradebook and performance breakdown will appear here</p>
          </div>
        ) : (
          <>
            {/* ── Topbar ── */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 gap-4 sticky top-0 z-10">
              {/* breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
                <span>2025 / 26</span>
                <span className="text-gray-200">/</span>
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: LEVEL_COLORS[selectedCourse.level]??'#9ca3af' }}/>
                <span className="font-mono text-xs text-gray-500 font-semibold">{selectedCourse.course_code}</span>
                <span className="font-medium text-gray-700 truncate">{selectedCourse.course_name}</span>
              </div>

              {/* actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => gradebookRef.current?.scrollIntoView({ behavior:'smooth' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                  Gradebook
                </button>
                <button
                  onClick={() => exportGradebookCSV(selectedCourse, students, marksMap, activeTypes, user)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export report
                </button>
                <button
                  onClick={() => setModal({ type:'edit', course:selectedCourse })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(selectedCourse)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-24"><Spinner size="lg"/></div>
            ) : (
              <div className="px-6 py-5 flex flex-col gap-5">

                {/* ── Course banner ── */}
                {(() => {
                  /* live clock helpers */
                  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  const liveDay  = dayNames[now.getDay()]
                  const liveTime = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
                  const liveDate = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })

                  /* fallbacks so the card always looks full */
                  const credits      = selectedCourse.credits      || '8'
                  const room         = selectedCourse.room         || 'Room 5'
                  const schedDays    = selectedCourse.schedule_days || `${liveDay}`
                  const schedTime    = selectedCourse.schedule_time || '08:00 – 10:00'

                  return (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-start justify-between gap-6 p-5">
                        <div className="flex-1 min-w-0">

                          {/* meta line: CODE badge · DESCRIPTION · YEAR X · Y CREDITS */}
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex-wrap">
                            <span
                              className="font-mono font-bold text-xs px-2 py-0.5 rounded border"
                              style={{
                                background:(LEVEL_COLORS[selectedCourse.level]||'#9ca3af')+'15',
                                color:LEVEL_COLORS[selectedCourse.level]||'#9ca3af',
                                borderColor:(LEVEL_COLORS[selectedCourse.level]||'#9ca3af')+'40',
                              }}
                            >{selectedCourse.course_code}</span>

                            {selectedCourse.description && (
                              <><span className="text-gray-200">·</span><span>{selectedCourse.description}</span></>
                            )}

                            {selectedCourse.level && (
                              <><span className="text-gray-200">·</span><span>Year {Math.floor(selectedCourse.level / 100)}</span></>
                            )}

                            <span className="text-gray-200">·</span>
                            <span>{credits} Credits</span>
                          </div>

                          {/* large course name */}
                          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-3">
                            {selectedCourse.course_name}
                          </h2>

                          {/* info row: SEMESTER · SCHEDULE (days + live clock) · ROOM · LECTURER */}
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
                            <span>
                              <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] mr-1.5">Semester</span>
                              <span className="font-semibold text-gray-700">2025 / 26</span>
                            </span>

                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Schedule</span>
                              <span className="font-semibold text-gray-700">{schedDays}</span>
                              <span className="text-gray-300">·</span>
                              <span className="font-semibold text-gray-700">{schedTime}</span>
                              {/* live clock */}
                              <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 font-mono text-[11px] text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                                {liveTime}
                              </span>
                            </span>

                            <span>
                              <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] mr-1.5">Room</span>
                              <strong className="text-gray-700">{room}</strong>
                            </span>

                            {user?.full_name && (
                              <span>
                                <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] mr-1.5">Lecturer</span>
                                <strong className="text-gray-700">{user.full_name}</strong>
                              </span>
                            )}
                          </div>

                        </div>

                        {/* ── Stat cards ── */}
                        <div className="flex gap-6 shrink-0">

                          {/* ENROLLED */}
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Enrolled</p>
                            <p className="text-2xl font-bold tabular-nums text-gray-900">{students.length}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{ASSESS_TYPES.length} assessments</p>
                          </div>

                          {/* CLASS AVG */}
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Class Avg</p>
                            <p className={`text-2xl font-bold tabular-nums ${
                              classAvg==null?'text-gray-400':classAvg<50?'text-red-600':classAvg>=70?'text-emerald-600':'text-gray-900'
                            }`}>
                              {classAvg!=null?`${fmtW(classAvg)}%`:'—'}
                            </p>
                            {/* delta vs prev — placeholder until historical data is available */}
                            <p className="text-[11px] text-gray-300 mt-0.5">— vs prev</p>
                          </div>

                          {/* PASS RATE */}
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Pass Rate</p>
                            <p className={`text-2xl font-bold tabular-nums ${
                              students.length&&passRate<50?'text-red-600':'text-gray-900'
                            }`}>
                              {students.length?`${passRate}%`:'—'}
                            </p>
                            <p className="text-[11px] text-gray-300 mt-0.5">— vs prev</p>
                          </div>

                          {/* AT RISK */}
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">At Risk</p>
                            <p className={`text-2xl font-bold tabular-nums ${atRisk>0?'text-red-600':'text-gray-900'}`}>
                              {atRisk}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{onWatch} on watch</p>
                          </div>

                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Two-column: histogram + performance ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                  {/* Grade distribution */}
                  <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Grade distribution</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {students.length} weighted finals · 10-pt buckets
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Bars / Curve toggle */}
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                          {['bars','curve'].map(m => (
                            <button key={m}
                              onClick={() => setChartMode(m)}
                              className={`px-3 py-1 capitalize transition-colors ${
                                chartMode===m
                                  ? 'bg-gray-900 text-white'
                                  : 'text-gray-500 hover:bg-gray-50'
                              }`}
                            >{m.charAt(0).toUpperCase()+m.slice(1)}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* grade legend */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      {GRADE_BUCKETS.map(b => (
                        <div key={b.key}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:b.color }}/>
                          <span className="text-gray-500 font-mono">{b.label}</span>
                          <span className="font-bold text-gray-700">{dist[b.key]}</span>
                        </div>
                      ))}
                    </div>

                    {!students.length ? (
                      <div className="h-48 flex items-center justify-center">
                        <p className="text-sm text-gray-400">No students enrolled</p>
                      </div>
                    ) : (
                      <GradeHistogram studentAverages={studentWeightedAvgs} mode={chartMode}/>
                    )}
                  </div>

                  {/* Performance by assessment */}
                  <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                    <div className="mb-4 flex items-start justify-between shrink-0">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Performance by assessment</p>
                        <p className="text-xs text-gray-400 mt-0.5">Class average per piece · ▲▼ vs previous cohort</p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded whitespace-nowrap">
                        weights total 100
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <AssessmentPerf typeAverages={typeAverages} />
                    </div>
                  </div>
                </div>

                {/* ── Gradebook ── */}
                <div ref={gradebookRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Gradebook</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {students.length} students · click a row to open detail · click a column to sort
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                        on track {studentWeightedAvgs.filter(v=>v!=null&&v>=65).length}
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                        watch {onWatch}
                      </span>
                      <span className="flex items-center gap-1.5 text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                        at risk {atRisk}
                      </span>
                    </div>
                  </div>

                  <Gradebook
                    students={students}
                    marksMap={marksMap}
                    activeTypes={activeTypes}
                    onSelectStudent={setSelectedStudent}
                  />

                  {!students.length && (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                      <p className="text-gray-400 text-sm">No students enrolled in this course yet.</p>
                      <p className="text-xs text-gray-300">Students auto-enrol based on programme and level assignments.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* ══ STUDENT DETAIL PANEL ══ */}
      {selectedStudent && (
        <StudentDetailPanel
          student={selectedStudent}
          marks={marksMap[selectedStudent.id]||[]}
          activeTypes={activeTypes}
          course={selectedCourse}
          user={user}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* ══ MODALS ══ */}

      <Modal isOpen={modal.type==='create'} onClose={() => setModal({type:null})} title="Create New Course">
        <CourseForm onSubmit={handleCreate} loading={actionLoad}/>
      </Modal>

      <Modal isOpen={modal.type==='edit'} onClose={() => setModal({type:null})} title="Edit Course">
        <CourseForm initial={modal.course} onSubmit={handleEdit} loading={actionLoad}/>
      </Modal>

      <Modal isOpen={modal.type==='assign'} onClose={skipAssign} title="Assign to a class">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Link <strong className="text-gray-800">{justCreated?.course_name}</strong> to a programme
            and level so students auto-enrol.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Programme</label>
            <select value={assignForm.programme}
              onChange={e => setAssignForm({...assignForm,programme:e.target.value})}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select programme…</option>
              {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Level</label>
              <select value={assignForm.level}
                onChange={e => setAssignForm({...assignForm,level:e.target.value})}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Level…</option>
                {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Semester</label>
              <select value={assignForm.semester}
                onChange={e => setAssignForm({...assignForm,semester:e.target.value})}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Optional</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Academic Year</label>
            <input value={assignForm.academic_year}
              onChange={e => setAssignForm({...assignForm,academic_year:e.target.value})}
              placeholder="e.g. 2025/2026"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"/>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={skipAssign}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Skip for now
            </button>
            <Button variant="teal" onClick={handleSaveAssignment} loading={savingAssign} className="flex-1">
              Save Assignment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Course">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" className="mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-sm text-red-700">
              Deleting <strong>{deleteTarget?.course_name}</strong> will permanently remove all
              materials, announcements, chat history, and student enrolments.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoad} className="flex-1">
              Delete Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
