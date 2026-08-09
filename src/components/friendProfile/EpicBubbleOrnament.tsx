export type EpicBubbleOrnamentType =
  | 'rustic'
  | 'vine'
  | 'wave'
  | 'crystal'
  | 'arcane'
  | 'flame'
  | 'royal'
  | 'nebula'
  | 'mystic'
  | 'titan'
  | 'legend'
  | 'divine'
  | 'default'

interface EpicBubbleOrnamentProps {
  type?: EpicBubbleOrnamentType | string
  className?: string
}

function EpicBubbleOrnament({ type = 'default', className }: EpicBubbleOrnamentProps) {
  if (type === 'rustic') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M4 12c2-4 4-6 8-6s6 2 8 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="12" cy="8" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  if (type === 'divine') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M12 3l1.8 5.5H19l-4.6 3.3 1.8 5.5L12 14l-4.2 3.3 1.8-5.5L5 8.5h5.2L12 3z" fill="currentColor" opacity="0.9" />
      </svg>
    )
  }
  if (type === 'flame' || type === 'arcane') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M12 4c-2 3-4 4.5-4 8a4 4 0 008 0c0-3.5-2-5-4-8z" fill="currentColor" opacity="0.85" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 12h12M12 6v12" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default EpicBubbleOrnament
