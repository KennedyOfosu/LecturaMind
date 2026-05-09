/**
 * MaterialsView.jsx — Browse and download course materials.
 */

import { useState, useEffect } from 'react'
import { materialService } from '../../services/materialService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Card } from '../../components/ui/Card'
import { formatDate } from '../../utils/formatDate'

export default function MaterialsView({ courseId }) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    materialService.getByCourse(courseId)
      .then((res) => setMaterials(res.data))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!materials.length) return (
    <EmptyState icon="📂" title="No materials yet" description="Your lecturer hasn't uploaded any materials for this course yet." />
  )

  return (
    <div className="flex flex-col gap-3">
      {materials.map((m) => (
        <Card key={m.id} className="flex items-center gap-4">
          <span className="text-3xl">{m.file_type === 'pdf' ? '📕' : '📘'}</span>
          <div className="flex-1">
            <p className="font-medium text-gray-800">{m.file_name}</p>
            <p className="text-xs text-gray-400">Uploaded {formatDate(m.uploaded_at)}</p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg uppercase font-medium">
            {m.file_type}
          </span>
        </Card>
      ))}
    </div>
  )
}
