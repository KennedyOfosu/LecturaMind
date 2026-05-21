/**
 * MaterialsView.jsx — Flat-row list of course materials.
 */

import { useState, useEffect } from 'react'
import { materialService } from '../../services/materialService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'

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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

export default function MaterialsView({ courseId }) {
  const toast = useToast()
  const [materials,   setMaterials]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState(false)
  const [downloading, setDownloading] = useState(null)

  const load = () => {
    setLoading(true)
    setFetchError(false)
    materialService.getByCourse(courseId)
      .then((res) => setMaterials(res.data || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [courseId])

  const handleDownload = async (m) => {
    setDownloading(m.id)
    try {
      const res = await materialService.getDownloadUrl(m.id)
      const link = document.createElement('a')
      link.href = res.data.url
      link.download = m.file_name
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      toast.error('Could not generate download link. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-gray-500">Could not load materials. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#111' }}>
        Try again
      </button>
    </div>
  )

  if (!materials.length) return (
    <EmptyState
      icon="📂"
      title="No materials yet"
      description="Your lecturer hasn't uploaded any materials for this course yet. Check back later."
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {materials.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between px-5 py-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
        >
          {/* Left: icon + info */}
          <div className="flex items-center gap-4 min-w-0">
            <FileIcon type={m.file_type} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{m.file_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Uploaded {fmtDate(m.uploaded_at)}</p>
            </div>
          </div>

          {/* Right: type badge + download button */}
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500 uppercase tracking-wide">
              {(m.file_type || 'file').split('/').pop()}
            </span>
            <button
              onClick={() => handleDownload(m)}
              disabled={downloading === m.id}
              title="Download file"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-40"
            >
              {downloading === m.id
                ? <Spinner size="sm" />
                : <DownloadIcon />}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
