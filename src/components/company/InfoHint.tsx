import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './InfoHint.module.css'

type InfoHintProps = {
  /** Contenido de la ventana flotante (texto o JSX). */
  children: ReactNode
  /** Etiqueta accesible del botón. */
  label?: string
}

type Position = { top: number; left: number; width: number; caret: number }

/**
 * Botón «i» que se coloca junto a un título. Al pulsarlo abre una ventana
 * flotante con el texto de ayuda, para no ocupar espacio de forma permanente.
 */
export default function InfoHint({ children, label = 'Más información' }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      if (!trigger) {
        return
      }

      const margin = 12
      const width = Math.min(300, window.innerWidth - margin * 2)
      const anchorX = trigger.left + trigger.width / 2
      let left = anchorX - width / 2
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - width))

      setPos({
        top: trigger.bottom + 10,
        left,
        width,
        caret: anchorX - left,
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popoverRef}
              id={id}
              role="tooltip"
              className={styles.popover}
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                ['--info-caret' as string]: `${pos.caret}px`,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
