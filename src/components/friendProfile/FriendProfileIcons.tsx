interface IconProps {
  className?: string
}

export function IconMapPin({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconSpark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l1.6 5.8L19 9l-5.4 1.2L12 16l-1.6-5.8L5 9l5.4-1.2L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 17l.8 2.8L22 20l-2.2.5L19 23l-.8-2.5L16 20l2.2-.5L19 17z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
    </svg>
  )
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconTag({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12l-8 8-9-9V4h7l10 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconTarget({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconUtensils({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3v8a3 3 0 006 0V3M9 11v10M6 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 3v18M20 3c-1.5 0-3 1.5-3 4v4c0 2.5 1.5 4 3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrophy({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v3a6 6 0 01-12 0V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 5H4a2 2 0 002 3M18 5h2a2 2 0 01-2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13v4M8 21h8M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
