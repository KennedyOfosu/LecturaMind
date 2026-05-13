/**
 * LevelFilter.jsx — Shared level filter tabs and grouped course selector for lecturer pages.
 */

const LEVELS = [100, 200, 300, 400]

/** Horizontal level filter pill tabs */
export function LevelTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {['all', ...LEVELS].map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
            active === l
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          {l === 'all' ? 'All Levels' : `Level ${l}`}
        </button>
      ))}
    </div>
  )
}

/** Course <select> grouped by level using <optgroup> */
export function GroupedCourseSelect({ courses, value, onChange, className = '' }) {
  const grouped = LEVELS.reduce((acc, l) => {
    const filtered = courses.filter((c) => c.level === l)
    if (filtered.length) acc[l] = filtered
    return acc
  }, {})

  const ungrouped = courses.filter((c) => !c.level)

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`}
    >
      {Object.entries(grouped).map(([level, lvlCourses]) => (
        <optgroup key={level} label={`Level ${level}`}>
          {lvlCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.course_name} ({c.course_code})
            </option>
          ))}
        </optgroup>
      ))}
      {ungrouped.length > 0 && (
        <optgroup label="Other">
          {ungrouped.map((c) => (
            <option key={c.id} value={c.id}>
              {c.course_name} ({c.course_code})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/** Filter an array of courses by selected level ('all' = return all) */
export function filterByLevel(courses, level) {
  return level === 'all' ? courses : courses.filter((c) => c.level === level)
}
