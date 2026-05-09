/**
 * Return true if the user object has the specified role.
 * @param {object|null} user
 * @param {'lecturer'|'student'} role
 * @returns {boolean}
 */
export function hasRole(user, role) {
  return user?.role === role
}

/**
 * Return the default dashboard path for a given role.
 * @param {'lecturer'|'student'} role
 * @returns {string}
 */
export function dashboardPath(role) {
  return role === 'lecturer' ? '/lecturer/dashboard' : '/student/dashboard'
}
