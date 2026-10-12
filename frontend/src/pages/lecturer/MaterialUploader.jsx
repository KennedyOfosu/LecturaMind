import { useState, useEffect, useRef } from 'react'
import { courseService } from '../../services/courseService'
import { materialService } from '../../services/materialService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'
import { GroupedCourseSelect } from '../../components/ui/LevelFilter'

/* ── helpers ── */

const ALLOWED = ['pdf', 'docx', 'pptx', 'ppt']
const MAX_SIZE = 10 * 1024 * 1024

const AVATAR_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]

function colorFromName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileType(ext) {
  if (ext === 'pdf') return { label: 'PDF', bg: 'bg-red-500' }
  if (ext === 'docx' || ext === 'doc') return { label: 'DOCX', bg: 'bg-blue-600' }
  if (ext === 'pptx' || ext === 'ppt') return { label: 'PPTX', bg: 'bg-orange-500' }
  return { label: 'FILE', bg: 'bg-gray-500' }
}

function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (!ALLOWED.includes(ext)) return { valid: false, msg: 'Only PDF, DOCX, and PPTX files are allowed' }
  if (file.size > MAX_SIZE) return { valid: false, msg: 'File size must be under 10 MB' }
  if (file.size === 0) return { valid: false, msg: 'The selected file is empty' }
  return { valid: true }
}

/* ── component ── */

export default function MaterialUploader() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [materials, setMaterials] = useState([])
  const [students, setStudents] = useState([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [stagedFiles, setStagedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  /* ── data fetching ── */

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    setLoadingMaterials(true)
    materialService
      .getByCourse(selectedCourse)
      .then((res) => setMaterials(res.data))
      .finally(() => setLoadingMaterials(false))
  }, [selectedCourse])

  useEffect(() => {
    if (!selectedCourse) { setStudents([]); return }
    courseService
      .getStudents(selectedCourse)
      .then((res) => setStudents(Array.isArray(res.data) ? res.data : []))
      .catch(() => setStudents([]))
  }, [selectedCourse])

  /* ── staged files management ── */

  const addFilesToStage = (files) => {
    const valid = []
    for (const file of files) {
      const result = validateFile(file)
      if (result.valid) valid.push(file)
      else toast.error(`${file.name}: ${result.msg}`)
    }
    if (valid.length) setStagedFiles((prev) => [...prev, ...valid])
  }

  const removeStagedFile = (index) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  /* ── drag & drop / browse ── */

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFilesToStage(Array.from(e.dataTransfer.files))
  }

  const handleFileChange = (e) => {
    addFilesToStage(Array.from(e.target.files))
    e.target.value = ''
  }

  /* ── upload all staged files sequentially ── */

  const handleUploadAll = async () => {
    if (!stagedFiles.length) return
    if (!selectedCourse) {
      toast.error('Please select a course first')
      return
    }
    setUploading(true)
    setUploadError('')

    for (let i = 0; i < stagedFiles.length; i++) {
      const file = stagedFiles[i]
      setUploadingFile(file.name)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('course_id', selectedCourse)

      try {
        await materialService.upload(formData, (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        toast.success(`${file.name} uploaded successfully.`)
      } catch (err) {
        const rawMsg = err.response?.data?.error || err.message || ''
        const lower = rawMsg.toLowerCase()
        let msg
        if (lower.includes('too large') || lower.includes('size'))
          msg = 'File is too large. Maximum allowed size is 10MB.'
        else if (lower.includes('unsupported') || lower.includes('type') || lower.includes('format'))
          msg = 'Unsupported file type. Please upload a PDF, DOCX, or PPTX file.'
        else if (lower.includes('storage'))
          msg = `Storage upload failed: ${rawMsg.replace(/^Storage upload failed:?\s*/i, '')}`
        else msg = rawMsg || 'Upload failed.'
        setUploadError(msg)
        toast.error(`${file.name}: ${msg}`)
      }
    }

    const res = await materialService.getByCourse(selectedCourse)
    setMaterials(res.data)
    setStagedFiles([])
    setUploadingFile(null)
    setUploadProgress(100)
    setUploading(false)
  }

  /* ── delete material ── */

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await materialService.delete(deleteTarget.id)
      toast.info('Material removed from this course.')
      setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete this material. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  /* ── render helpers ── */

  const FileTypeBadge = ({ ext }) => {
    const info = getFileType(ext)
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white ${info.bg}`}>
        {info.label}
      </span>
    )
  }

  const TrashIcon = () => (
    <svg className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )

  /* ── render ── */

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Material Uploader</h1>
        <p className="text-gray-500 text-sm mt-1">Upload PDF or DOCX course materials — the AI indexes them instantly</p>
      </div>

      {/* Course selector */}
      <Card>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
        <GroupedCourseSelect
          courses={courses}
          value={selectedCourse}
          onChange={setSelectedCourse}
          className="w-full md:w-80"
        />
      </Card>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ════ Left column: Uploaded Materials ════ */}
        <Card>
          {students.length > 0 && (
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Enrolled ({students.length})
              </span>
              <div className="flex -space-x-2">
                {students.slice(0, 5).map((s) => {
                  const name = s.name || s.full_name || s.email || ''
                  return (
                    <div
                      key={s.id}
                      title={name}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white cursor-default"
                      style={{ backgroundColor: colorFromName(name) }}
                    >
                      {getInitials(name) || '?'}
                    </div>
                  )
                })}
                {students.length > 5 && (
                  <div
                    title={`${students.length - 5} more enrolled`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-gray-100 text-gray-500 ring-2 ring-white"
                  >
                    +{students.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-navy mb-4">Uploaded Materials</h2>

          {loadingMaterials ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !materials.length ? (
            <EmptyState icon="📂" title="No materials yet" description="Upload your first PDF or DOCX to get started" />
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {materials.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">
                      {m.file_type === 'pdf' ? '📕' : m.file_type === 'pptx' ? '📊' : '📘'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.file_name}</p>
                      <p className="text-xs text-gray-400">Uploaded {formatDate(m.uploaded_at)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(m)} className="shrink-0">Delete</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ════ Right column: Upload Files ════ */}
        <Card className="flex flex-col gap-5">
          <h2 className="font-semibold text-navy">Upload Files</h2>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-teal bg-teal/5'
                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="font-medium text-gray-700">Drop file here or browse</p>
              <p className="text-sm text-gray-400">PDF, DOCX, or PPTX up to 10 MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.ppt"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Staged Files Queue */}
          {stagedFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              {stagedFiles.map((file, idx) => {
                const ext = file.name.split('.').pop().toLowerCase()
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileTypeBadge ext={ext} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStagedFile(idx)}
                      className="shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div className="px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
              {uploadError}
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUploadAll}
            disabled={!stagedFiles.length || uploading}
            loading={uploading}
            className="w-full !bg-black !text-white hover:!bg-gray-800 !rounded-xl !py-3 !font-semibold"
          >
            {uploading ? `Uploading… ${uploadProgress}%` : 'Upload'}
          </Button>

          {/* Active progress bar beneath uploader zone */}
          {uploading && uploadingFile && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="truncate">Uploading {uploadingFile}…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Material">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">Are you sure you want to delete <strong>{deleteTarget?.file_name}</strong>? The extracted text will also be removed from the AI context.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
