import { useState } from 'react'

const SIZES = {
  sm: 'h-7 w-7 text-xs font-bold',
  md: 'h-9 w-9 text-sm font-bold',
  lg: 'h-16 w-16 text-xl font-bold',
}

export function Avatar({ src, name, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false)

  const initials = (name || '')
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 ${SIZES[size]} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 text-white ${SIZES[size]} ${className}`}
      style={{ backgroundColor: '#374151' }}
    >
      {initials}
    </div>
  )
}
