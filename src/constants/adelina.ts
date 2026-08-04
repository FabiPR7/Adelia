import adelinaCoinUrl from '../assets/adelina.webp'

export { adelinaCoinUrl }

export const ADELINA_LABEL = 'Adelinas'

export type AdelinaIconKind = 'adelina' | 'adelina-review'

export function isAdelinaIcon(icon: string): icon is AdelinaIconKind {
  return icon === 'adelina' || icon === 'adelina-review'
}

export function adelinaIconForMission(category?: string, icon?: string): AdelinaIconKind | null {
  if (icon && isAdelinaIcon(icon)) {
    return icon
  }

  if (category === 'reviews') {
    return 'adelina-review'
  }

  if (category === 'rewards' && icon !== '🗝️' && icon !== '🎁') {
    return 'adelina'
  }

  return null
}
