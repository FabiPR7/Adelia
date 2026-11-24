import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Modo claro / oscuro del panel del restaurante. Es una preferencia de este
 * dispositivo (se guarda en el navegador): «Automático» sigue al móvil u ordenador.
 */
export type PanelThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'adelia.panelTheme'
const listeners = new Set<() => void>()

function readChoice(): PanelThemeChoice {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'light'
  } catch {
    return 'light'
  }
}

let current: PanelThemeChoice = typeof window === 'undefined' ? 'light' : readChoice()

export function setPanelThemeChoice(choice: PanelThemeChoice): void {
  current = choice
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Sin almacenamiento (modo privado): dura hasta recargar.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Lo que eligió el restaurante. */
export function usePanelThemeChoice(): PanelThemeChoice {
  return useSyncExternalStore(subscribe, () => current, () => 'light')
}

/** El tema que se ve ahora (resuelve «Automático» con el del dispositivo). */
export function useResolvedPanelTheme(): 'light' | 'dark' {
  const choice = usePanelThemeChoice()
  const [systemDark, setSystemDark] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ))
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  if (choice === 'system') return systemDark ? 'dark' : 'light'
  return choice
}
