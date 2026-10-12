/**
 * Return true if the user object has the specified role.
 * @param {object|null} user
 * @param {'superadmin'|'lecturer'|'student'} role
 * @returns {boolean}
 */
export function hasRole(user, role) {
  return user?.role === role
}

/**
 * Return the default dashboard path for a given role.
 * @param {'superadmin'|'lecturer'|'student'} role
 * @returns {string}
 */
export function dashboardPath(role) {
  const paths = {
    superadmin: '/superadmin/dashboard',
    lecturer: '/lecturer/dashboard',
    student: '/student/dashboard',
  }
  return paths[role] || '/login'
}
