/**
 * Badge.jsx — Status and role badge component.
 */

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    navy: 'bg-navy/10 text-navy',
    teal: 'bg-teal/10 text-teal-dark',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    lecturer: 'bg-navy/10 text-navy',
    student: 'bg-teal/10 text-teal-dark',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  )
}
