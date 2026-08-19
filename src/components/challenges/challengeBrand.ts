import { createElement } from 'react'
import { ADELIA_LOGO_URL } from '../../constants/brand'

export function AdeliaMark({ className = 'h-8 w-8' }: { className?: string }) {
  return createElement('img', {
    src: ADELIA_LOGO_URL,
    alt: 'Adelia',
    className,
    draggable: false,
  })
}

export function usablePlayerPhoto(url: string | undefined | null): string {
  const value = typeof url === 'string' ? url.trim() : ''
  if (!value) {
    return ''
  }

  const lower = value.toLowerCase()
  if (
    lower.includes('adelina.webp')
    || /\/adelina([?#].*)?$/.test(lower)
    || lower.includes('assets/adelina')
  ) {
    return ''
  }

  return value
}

export function playerInitials(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0]?.slice(0, 1).toUpperCase() ?? '?'
  }
  return `${parts[0]?.slice(0, 1) ?? ''}${parts[1]?.slice(0, 1) ?? ''}`.toUpperCase()
}
