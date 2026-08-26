const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconUsers() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconBuildings() {
  return (
    <svg {...iconProps}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  )
}

export function IconCalendar() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  )
}

export function IconGuests() {
  return (
    <svg {...iconProps}>
      <path d="M4 19h16M7 19V9l5-4 5 4v10" />
      <path d="M10 19v-5h4v5" />
    </svg>
  )
}

export function IconTrend() {
  return (
    <svg {...iconProps}>
      <path d="M4 17l6-6 3 3 7-7" />
      <path d="M14 7h6v6" />
    </svg>
  )
}

export function IconBan() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 7l10 10" />
    </svg>
  )
}

export function IconCrown() {
  return (
    <svg {...iconProps}>
      <path d="M3 18h18M5 18l2-9 5 4 5-4 2 9" />
    </svg>
  )
}

export function IconClock() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

export function IconOverview() {
  return (
    <svg {...iconProps}>
      <path d="M4 13h6V4H4zM14 20h6V10h-6zM4 20h6v-5H4zM14 8h6V4h-6z" />
    </svg>
  )
}

export function IconLogout() {
  return (
    <svg {...iconProps}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h11M12 9l3 3-3 3" />
    </svg>
  )
}

export function IconRefresh() {
  return (
    <svg {...iconProps}>
      <path d="M20 12a8 8 0 1 1-2.2-5.5" />
      <path d="M20 5v5h-5" />
    </svg>
  )
}

export function IconDownload() {
  return (
    <svg {...iconProps}>
      <path d="M12 4v11M8 11l4 4 4-4M5 19h14" />
    </svg>
  )
}

export function IconPlus() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconSearch() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

export function IconPlans() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}

export function IconInbox() {
  return (
    <svg {...iconProps}>
      <path d="M4 13h4l2 3h4l2-3h4v6H4z" />
      <path d="M4 13l3-8h10l3 8" />
    </svg>
  )
}

export function IconShield() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6l8-3z" />
    </svg>
  )
}

export function IconSpark() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.4 6.2L20 12l-6.6 2.8L12 21l-1.4-6.2L4 12l6.6-2.8L12 3z" />
    </svg>
  )
}

export function IconPlay() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9l6 3-6 3z" />
    </svg>
  )
}

export function IconAlert() {
  return (
    <svg {...iconProps}>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 16.5h.01" />
    </svg>
  )
}
