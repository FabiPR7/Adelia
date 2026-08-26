interface FacilityIconProps {
  name: string
}

function FacilityIcon({ name }: FacilityIconProps) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'parking':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M9 16V8h4.2a3 3 0 010 6H9" />
        </svg>
      )
    case 'wifi':
      return (
        <svg {...common}>
          <path d="M5 12.5a9 9 0 0114 0" />
          <path d="M8.2 15.2a5 5 0 017.6 0" />
          <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'card':
      return (
        <svg {...common}>
          <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
          <path d="M3.5 10h17" />
        </svg>
      )
    case 'cash':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      )
    case 'phone_pay':
      return (
        <svg {...common}>
          <rect x="8" y="3.5" width="8" height="17" rx="2" />
          <path d="M11 18.5h2" />
        </svg>
      )
    case 'restrooms':
      return (
        <svg {...common}>
          <circle cx="8" cy="7" r="2" />
          <path d="M5.5 20v-7.5a2.5 2.5 0 015 0V20" />
          <circle cx="16" cy="7" r="2" />
          <path d="M14 12.5h4l1 7.5h-6l1-7.5z" />
        </svg>
      )
    case 'accessible':
      return (
        <svg {...common}>
          <circle cx="8.5" cy="5.5" r="1.6" />
          <path d="M10 9.2l2.2 1.4M8.2 9.5l1.4 4.2 4.4.8" />
          <circle cx="14.5" cy="16" r="4" />
          <path d="M12.4 16h4.2" />
        </svg>
      )
    case 'terrace':
      return (
        <svg {...common}>
          <path d="M4 14h16" />
          <path d="M7 14V9m10 5V9" />
          <path d="M4 9h16l-2-4H6L4 9z" />
        </svg>
      )
    case 'pet':
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="1.4" />
          <circle cx="16" cy="9" r="1.4" />
          <circle cx="6.5" cy="13" r="1.3" />
          <circle cx="17.5" cy="13" r="1.3" />
          <ellipse cx="12" cy="15.5" rx="3.2" ry="2.6" />
        </svg>
      )
    case 'snowflake':
      return (
        <svg {...common}>
          <path d="M12 4v16M6 8l12 8M18 8L6 16" />
        </svg>
      )
    case 'heat':
      return (
        <svg {...common}>
          <path d="M8 18c0-3 2-4.5 2-7 0-2-1.2-3.5-1.2-3.5S10 9 10 11c0 2-2 3.2-2 7" />
          <path d="M12 18c0-3 2-4.5 2-7 0-2-1.2-3.5-1.2-3.5S14 9 14 11c0 2-2 3.2-2 7" />
          <path d="M16 18c0-3 2-4.5 2-7" />
        </svg>
      )
    case 'kids':
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="2.4" />
          <path d="M8 20v-5.5a4 4 0 018 0V20" />
        </svg>
      )
    case 'chair':
      return (
        <svg {...common}>
          <path d="M7 12h10v3H7z" />
          <path d="M8 15v5m8-5v5M9 7v5" />
        </svg>
      )
    case 'groups':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2" />
          <circle cx="16" cy="8" r="2" />
          <path d="M4.5 18v-2.2A3.5 3.5 0 018 12.3a3.5 3.5 0 013.5 3.5V18" />
          <path d="M12.5 18v-2.2A3.5 3.5 0 0116 12.3a3.5 3.5 0 013.5 3.5V18" />
        </svg>
      )
    case 'door':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="12" height="16" rx="1" />
          <circle cx="14.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'music':
      return (
        <svg {...common}>
          <path d="M9 18V7l10-2v11" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="16" r="2" />
        </svg>
      )
    case 'tv':
      return (
        <svg {...common}>
          <rect x="3.5" y="6" width="17" height="11" rx="2" />
          <path d="M8 20h8" />
        </svg>
      )
    case 'bag':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8z" />
          <path d="M9 8V7a3 3 0 016 0v1" />
        </svg>
      )
    case 'bike':
      return (
        <svg {...common}>
          <circle cx="6.5" cy="16" r="3" />
          <circle cx="17.5" cy="16" r="3" />
          <path d="M6.5 16l4-8h4l3 8M10.5 8h4" />
        </svg>
      )
    case 'plant':
      return (
        <svg {...common}>
          <path d="M12 20V11" />
          <path d="M12 12c-4-1-6-5-6-8 4 0 7 3 7 8" />
          <path d="M12 12c4-1 6-5 6-8-4 0-7 3-7 8" />
        </svg>
      )
    case 'rooftop':
      return (
        <svg {...common}>
          <path d="M4 14l8-8 8 8" />
          <path d="M7 12v8h10v-8" />
        </svg>
      )
    case 'views':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M3 12c2.8-5 6.2-7.5 9-7.5S18.2 7 21 12c-2.8 5-6.2 7.5-9 7.5S5.8 17 3 12z" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 3L6 13h6l-1 8 7-10h-6l1-8z" />
        </svg>
      )
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M5 19c8-1 13-8 14-14-6 1-13 6-14 14z" />
          <path d="M8 16c3-3 6-6 9-8" />
        </svg>
      )
    case 'wheat':
      return (
        <svg {...common}>
          <path d="M12 21V8" />
          <path d="M12 8c-3-2-5-5-5-5 2 1 4 3 5 5zM12 8c3-2 5-5 5-5-2 1-4 3-5 5z" />
          <path d="M12 13c-3-1.5-5-4-5-4 2 .8 4 2.4 5 4zM12 13c3-1.5 5-4 5-4-2 .8-4 2.4-5 4z" />
        </svg>
      )
    case 'restaurant':
      return (
        <svg {...common}>
          <path d="M7 4v8a2 2 0 002 2v6" />
          <path d="M7 8h4M16 4v16" />
        </svg>
      )
    case 'bar':
      return (
        <svg {...common}>
          <path d="M6 5h12l-3.5 8H9.5L6 5z" />
          <path d="M12 13v6" />
        </svg>
      )
    case 'cafe':
      return (
        <svg {...common}>
          <path d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4V9z" />
          <path d="M16 10h2a2.5 2.5 0 010 5h-2" />
        </svg>
      )
    case 'tapas':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="15" rx="7" ry="3" />
          <path d="M8 14l2-7h4l2 7" />
        </svg>
      )
    case 'wine':
      return (
        <svg {...common}>
          <path d="M8 4h8l-1.5 7a4.5 4.5 0 11-5 0L8 4z" />
          <path d="M12 15v5M9 20h6" />
        </svg>
      )
    case 'cocktail':
      return (
        <svg {...common}>
          <path d="M6 5h12L12 13 6 5z" />
          <path d="M12 13v6M9 20h6" />
        </svg>
      )
    case 'bakery':
      return (
        <svg {...common}>
          <path d="M5 14c0-4 3-7 7-7s7 3 7 7v3H5v-3z" />
          <path d="M8 14v3m4-3v3m4-3v3" />
        </svg>
      )
    case 'ice_cream':
      return (
        <svg {...common}>
          <path d="M8 11a4 4 0 118 0" />
          <path d="M8 11h8l-4 9-4-9z" />
        </svg>
      )
    case 'truck':
      return (
        <svg {...common}>
          <path d="M3 15V8h10v7H3z" />
          <path d="M13 11h5l3 4v0H13" />
          <circle cx="7" cy="16.5" r="1.6" />
          <circle cx="17" cy="16.5" r="1.6" />
        </svg>
      )
    case 'hotel':
      return (
        <svg {...common}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      )
  }
}

export default FacilityIcon
