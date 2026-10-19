import { useMemo, useState } from 'react'
import { classroomLabel, classroomSearchText } from '../../utils/classroomDisplay'

export function ClassroomMultiSelect({
  classrooms = [],
  value = [],
  onChange,
  loading = false,
  error = '',
  onRetry,
  onCreateClass,
}) {
  const [search, setSearch] = useState('')
  const selectedIds = Array.isArray(value) ? value : []
  const selected = useMemo(
    () => classrooms.filter((classroom) => selectedIds.includes(classroom.id)),
    [classrooms, selectedIds.join('|')],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return classrooms
    return classrooms.filter((classroom) => classroomSearchText(classroom).includes(query))
  }, [classrooms, search])

  const toggle = (classroomId) => {
    const next = selectedIds.includes(classroomId)
      ? selectedIds.filter((id) => id !== classroomId)
      : [...selectedIds, classroomId]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected classes">
          {selected.map((classroom) => (
            <span key={classroom.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
              {classroomLabel(classroom)}
              <button type="button" onClick={() => toggle(classroom.id)} aria-label={`Remove ${classroomLabel(classroom)}`} className="ml-1 text-blue-700 hover:text-blue-950">×</button>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border px-3 py-3 text-xs text-gray-500" style={{ borderColor: '#D2D4D9' }}>Loading classes…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
          <p>{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Try again</button>}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          <p>No classes have been created yet. Add your school’s real classes before assigning this lecturer.</p>
          {onCreateClass && <button type="button" onClick={onCreateClass} className="mt-2 font-semibold underline">Go to class management</button>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#D2D4D9' }}>
          {!selected.length && <p className="px-3 pt-2 text-xs text-gray-400">Select assigned class(es)</p>}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes by name or code…"
            aria-label="Search classes"
            className="w-full border-b px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#D2D4D9' }}
          />
          <div className="max-h-36 overflow-y-auto p-1">
            {filtered.length ? filtered.map((classroom) => (
              <label key={classroom.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <input type="checkbox" checked={selectedIds.includes(classroom.id)} onChange={() => toggle(classroom.id)} />
                <span>{classroomLabel(classroom)}</span>
              </label>
            )) : <p className="px-3 py-3 text-xs text-gray-500">No classes match “{search}”.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
