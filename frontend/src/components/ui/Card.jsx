/**
 * Card.jsx — Reusable card container with optional hover effect.
 */

export function Card({ children, className = '', onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${hover ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
