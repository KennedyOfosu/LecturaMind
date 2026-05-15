/**
 * MaterialsView.jsx — Flat-row list of course materials.
 */

import { useState, useEffect } from 'react'
import { materialService } from '../../services/materialService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function FileIcon({ type }) {
  const t = (type || '').toLowerCase()
  const color = t === 'pdf' ? '#ef4444' : t === 'docx' || t === 'doc' ? '#3b82f6' : '#6366f1'
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: color + '18' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  )
}

export default function MaterialsView({ courseId }) {
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    materialService.getByCourse(courseId)
      .then((res) => setMaterials(res.data || []))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (!materials.length) return (
    <EmptyState
      icon="📂"
      title="No materials yet"
      description="Your lecturer hasn't uploaded any materials for this course yet. Check back later."
    />
  )

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {materials.map((m, i) => (
        <div
          key={m.id}
          className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50/70 transition-colors ${
            i < materials.length - 1 ? 'border-b border-gray-100' : ''
          }`}
        >
          {/* Left: icon + info */}
          <div className="flex items-center gap-4 min-w-0">
            <FileIcon type={m.file_type} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{m.file_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Uploaded {fmtDate(m.uploaded_at)}</p>
            </div>
          </div>

          {/* Right: type badge */}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500 uppercase tracking-wide shrink-0 ml-4">
            {(m.file_type || 'file').split('/').pop()}
          </span>
        </div>
      ))}
    </div>
  )
}
