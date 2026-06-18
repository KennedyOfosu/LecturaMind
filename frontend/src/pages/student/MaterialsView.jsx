/**
 * MaterialsView.jsx - Student material cards with download and share actions.
 */

import { useState, useEffect } from 'react'
import { materialService } from '../../services/materialService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'

const TYPE_META = {
  pdf: {
    label: 'PDF',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-100',
    summary: 'Lecture document prepared for reading, review, and AI-assisted study.',
  },
  docx: {
    label: 'DOCX',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    summary: 'Course document with notes, instructions, or extended written material.',
  },
  pptx: {
    label: 'Slides',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    summary: 'Presentation slides for key concepts, class walkthroughs, and revision.',
  },
  ppt: {
    label: 'Slides',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    summary: 'Presentation slides for key concepts, class walkthroughs, and revision.',
  },
  file: {
    label: 'File',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-100',
    summary: 'Course material uploaded by your lecturer for study and reference.',
  },
}

function getFileType(material) {
  const type = (material.file_type || '').toLowerCase()
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('doc')) return 'docx'
  if (type.includes('ppt')) return type.includes('pptx') ? 'pptx' : 'ppt'
  const ext = (material.file_name || '').split('.').pop()?.toLowerCase()
  return TYPE_META[ext] ? ext : 'file'
}

function cleanTitle(fileName) {
  if (!fileName) return 'Course material'
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

function getSummary(material, meta) {
  const explicit = material.summary || material.description
  if (explicit) return explicit
  const title = cleanTitle(material.file_name)
  return `${title} is a ${meta.label.toLowerCase()} resource. ${meta.summary}`
}

function FileIcon({ meta }) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${meta.bg} ${meta.text} ${meta.border}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
        <path d="M9 18h4" />
      </svg>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4" />
      <path d="M15.4 6.5l-6.8 4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </svg>
  )
}

function MaterialCard({ material, downloading, opening, sharing, onDownload, onOpen, onShare }) {
  const type = getFileType(material)
  const meta = TYPE_META[type] || TYPE_META.file
  const title = cleanTitle(material.file_name)

  return (
    <article className="flex min-h-[220px] flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <FileIcon meta={meta} />
        <button
          type="button"
          onClick={() => onShare(material)}
          disabled={sharing === material.id}
          title="Share material"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-900 hover:text-white disabled:opacity-50"
        >
          {sharing === material.id ? <Spinner size="sm" /> : <ShareIcon />}
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          <span className="truncate text-xs text-gray-400">
            {formatDate(material.uploaded_at)}
          </span>
        </div>

        <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-tight text-gray-950">
          {title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
          {getSummary(material, meta)}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDownload(material)}
          disabled={downloading === material.id || opening === material.id}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-900 hover:text-white disabled:opacity-50"
        >
          {downloading === material.id ? <Spinner size="sm" /> : <DownloadIcon />}
          <span>Download</span>
        </button>
        <button
          type="button"
          onClick={() => onOpen(material)}
          disabled={downloading === material.id || opening === material.id}
          title="Open material"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
        >
          {opening === material.id ? <Spinner size="sm" /> : <ArrowIcon />}
        </button>
      </div>
    </article>
  )
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to the older selection-based copy path below.
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.top = '-1000px'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()

  try {
    return Boolean(document.execCommand('copy'))
  } catch {
    return false
  } finally {
    document.body.removeChild(input)
  }
}

export default function MaterialsView({ courseId }) {
  const toast = useToast()
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [opening, setOpening] = useState(null)
  const [sharing, setSharing] = useState(null)

  const load = () => {
    setLoading(true)
    setFetchError(false)
    materialService.getByCourse(courseId)
      .then((res) => setMaterials(res.data || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [courseId])

  const getMaterialUrl = async (material) => {
    const res = await materialService.getDownloadUrl(material.id)
    if (!res.data?.url) throw new Error('Missing download URL')
    return res.data.url
  }

  const handleDownload = async (material) => {
    setDownloading(material.id)
    try {
      const url = await getMaterialUrl(material)
      const link = document.createElement('a')
      link.href = url
      link.download = material.file_name
      link.rel = 'noopener noreferrer'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Download started.')
    } catch {
      toast.error('Could not generate download link. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  const handleOpen = async (material) => {
    const tab = window.open('about:blank', '_blank', 'noopener,noreferrer')
    setOpening(material.id)
    try {
      const url = await getMaterialUrl(material)
      if (tab) {
        tab.location.href = url
      } else {
        window.location.href = url
      }
    } catch {
      if (tab) tab.close()
      toast.error('Could not open this material. Please try again.')
    } finally {
      setOpening(null)
    }
  }

  const handleShare = async (material) => {
    setSharing(material.id)
    try {
      const url = await getMaterialUrl(material)
      const title = cleanTitle(material.file_name)
      const shareData = { title, text: `Course material: ${title}`, url }

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try {
          await navigator.share(shareData)
          toast.success('Material shared.')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }

      const copied = await copyToClipboard(url)
      if (copied) {
        toast.success('Share link copied.')
        return
      }

      window.prompt('Copy this material link:', url)
      toast.info('Share link ready to copy.')
    } catch {
      toast.error('Could not create a share link. Please try again.')
    } finally {
      setSharing(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-gray-500">Could not load materials. Check your connection and try again.</p>
      <button onClick={load} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#111' }}>
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Course materials</h2>
          <p className="mt-1 text-sm text-gray-500">
            Documents, slides, and files uploaded for this course.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-500 shadow-sm">
          {materials.length} {materials.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {materials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            downloading={downloading}
            opening={opening}
            sharing={sharing}
            onDownload={handleDownload}
            onOpen={handleOpen}
            onShare={handleShare}
          />
        ))}
      </div>
    </div>
  )
}
