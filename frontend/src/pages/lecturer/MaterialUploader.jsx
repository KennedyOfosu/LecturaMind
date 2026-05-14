/**
 * MaterialUploader.jsx — Drag-and-drop file uploader with course selector and material list.
 */

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
import { LevelTabs, GroupedCourseSelect } from '../../components/ui/LevelFilter'

export default function MaterialUploader() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [materials, setMaterials] = useState([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    setLoadingMaterials(true)
    materialService.getByCourse(selectedCourse)
      .then((res) => setMaterials(res.data))
      .finally(() => setLoadingMaterials(false))
  }, [selectedCourse])

  const handleUpload = async (file) => {
    if (!file) return
    if (!selectedCourse) {
      toast.error('Please select a course first')
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const allowedExts = ['pdf', 'docx', 'pptx', 'ppt']
    if (!allowedExts.includes(ext)) {
      const msg = 'Only PDF, DOCX, and PPTX files are allowed'
      setUploadError(msg); toast.error(msg)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'File size must be under 10 MB'
      setUploadError(msg); toast.error(msg)
      return
    }
    if (file.size === 0) {
      const msg = 'The selected file is empty'
      setUploadError(msg); toast.error(msg)
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('course_id', selectedCourse)
    setUploading(true)
    setUploadError('')
    setUploadProgress(0)
    try {
      await materialService.upload(formData, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      toast.success(`${file.name} uploaded and indexed!`)
      setUploadProgress(100)
      const res = await materialService.getByCourse(selectedCourse)
      setMaterials(res.data)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed. Please try again.'
      setUploadError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await materialService.delete(deleteTarget.id)
      toast.success('Material deleted')
      setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete material')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Material Uploader</h1>
        <p className="text-gray-500 text-sm mt-1">Upload PDF or DOCX course materials — the AI indexes them instantly</p>
      </div>

      {/* Course selector with grouped levels */}
      <Card>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
        <GroupedCourseSelect
          courses={courses}
          value={selectedCourse}
          onChange={setSelectedCourse}
          className="w-full md:w-80"
        />
      </Card>

      {/* Drop zone */}
      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragOver ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-teal/50 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-gray-500 text-sm">
                Uploading… {uploadProgress > 0 && uploadProgress < 100 ? `${uploadProgress}%` : 'extracting text'}
              </p>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📄</div>
              <p className="font-medium text-gray-700">Drop your file here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">PDF, DOCX, or PPTX · Max 10 MB</p>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.ppt" className="hidden" onChange={(e) => handleUpload(e.target.files[0])} />
        {uploadError && (
          <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
            {uploadError}
          </div>
        )}
      </Card>

      {/* Materials list */}
      <Card>
        <h2 className="font-semibold text-navy mb-4">Uploaded Materials</h2>
        {loadingMaterials ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !materials.length ? (
          <EmptyState icon="📂" title="No materials yet" description="Upload your first PDF or DOCX to get started" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {materials.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.file_type === 'pdf' ? '📕' : m.file_type === 'pptx' ? '📊' : '📘'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.file_name}</p>
                    <p className="text-xs text-gray-400">Uploaded {formatDate(m.uploaded_at)}</p>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(m)}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delete confirmation */}
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
