export function classroomLabel(classroom, { includeLocation = true } = {}) {
  if (!classroom) return 'No class assigned'
  const room = classroom.physical_room || classroom.room || {}
  const roomName = room.name
    ? `${room.name}${room.code ? ` (${room.code})` : ''}`
    : classroom.room_name || 'Room not assigned'
  const programme = classroom.programme || classroom.program || ''
  const level = classroom.level ? `Level ${classroom.level}` : ''
  const parts = [roomName, programme, level].filter(Boolean)
  const location = includeLocation ? [room.building, room.campus].filter(Boolean) : []
  return [...parts, ...location].join(' | ') || classroom.name || 'Class details unavailable'
}

export function classroomSearchText(classroom) {
  const room = classroom?.physical_room || classroom?.room || {}
  return [
    classroom?.name, classroom?.code, classroom?.programme, classroom?.level,
    room.name, room.code, room.building, room.campus,
  ].filter(Boolean).join(' ').toLocaleLowerCase()
}
