import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TOUR_STEPS, type TourStepConfig, type TourStepId } from '../../customerTour/tourSteps'
import styles from './CustomerProductTourOverlay.module.css'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface CustomerProductTourOverlayProps {
  stepId: TourStepId
  stepIndex: number
  stepCount: number
  onPrimary: () => void
  onSkip: () => void
}

const EMPTY: Rect = { top: 0, left: 0, width: 0, height: 0 }

function unionChildRects(el: HTMLElement): DOMRect | null {
  const children = Array.from(el.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
  if (children.length === 0) return null

  let top = Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const child of children) {
    const rect = child.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    top = Math.min(top, rect.top)
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  if (!Number.isFinite(top) || right <= left || bottom <= top) {
    return null
  }

  return new DOMRect(left, top, right - left, bottom - top)
}

function resolvePads(step: TourStepConfig) {
  const base = step.pad ?? 8
  return {
    top: step.padTop ?? base,
    bottom: step.padBottom ?? base,
    x: step.padX ?? base,
  }
}

/** Compensa el desfase layout vs visual viewport (móvil / barra del navegador). */
function getVisualViewportOffset() {
  const vv = window.visualViewport
  if (!vv) return { top: 0, left: 0 }
  return {
    top: vv.offsetTop,
    left: vv.offsetLeft,
  }
}

function measureTarget(step: TourStepConfig): Rect | null {
  const el = document.querySelector(`[data-tour="${step.targetId}"]`)
  if (!(el instanceof HTMLElement)) {
    return null
  }

  const measureChildren = el.getAttribute('data-tour-measure') === 'children'
  const rect = measureChildren ? unionChildRects(el) ?? el.getBoundingClientRect() : el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) {
    return null
  }

  const pads = resolvePads(step)
  const offset = getVisualViewportOffset()
  const top = Math.max(0, rect.top + offset.top - pads.top + (step.shiftTop ?? 0))
  const left = Math.max(0, rect.left + offset.left - pads.x + (step.shiftLeft ?? 0))
  const right = rect.right + offset.left + pads.x + (step.shiftLeft ?? 0)
  const bottom = rect.bottom + offset.top + pads.bottom + (step.shiftTop ?? 0)

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

function CustomerProductTourOverlay({
  stepId,
  stepIndex,
  stepCount,
  onPrimary,
  onSkip,
}: CustomerProductTourOverlayProps) {
  const step = TOUR_STEPS.find((item) => item.id === stepId) ?? TOUR_STEPS[0]
  const reduceMotion = useReducedMotion()
  const [hole, setHole] = useState<Rect>(EMPTY)
  const [ready, setReady] = useState(false)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  useLayoutEffect(() => {
    let cancelled = false
    let tries = 0
    let raf1 = 0
    let raf2 = 0

    const target = document.querySelector(`[data-tour="${step.targetId}"]`)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    const update = () => {
      if (cancelled) return
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      const next = measureTarget(step)
      if (next) {
        setHole(next)
        setReady(true)
        return
      }

      setReady(false)
      if (tries < 40) {
        tries += 1
        window.setTimeout(update, 80)
      }
    }

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(update)
    })

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [step, stepId])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const coachPlacement = useMemo(() => {
    if (!ready) return 'bottom' as const
    const holeCenterY = hole.top + hole.height / 2
    return holeCenterY > viewport.h * 0.58 ? ('top' as const) : ('bottom' as const)
  }, [hole, ready, viewport.h])

  const spotRadius = ready
    ? (step.id === 'restaurant-actions' ? 17 : Math.min(16, Math.max(12, hole.height * 0.35)))
    : 14

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Tutorial de Adelia">
      {ready ? (
        <div
          className={styles.spotlight}
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: spotRadius,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className={styles.scrimFallback} aria-hidden="true" />
      )}

      <div className={styles.clickShield} aria-hidden="true">
        {!ready || !step.allowTargetClick ? (
          <button type="button" className={styles.fullBlock} tabIndex={-1} aria-hidden="true" />
        ) : (
          <>
            <button
              type="button"
              className={styles.blockPane}
              style={{ top: 0, left: 0, width: viewport.w, height: hole.top }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className={styles.blockPane}
              style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className={styles.blockPane}
              style={{
                top: hole.top,
                left: hole.left + hole.width,
                width: Math.max(0, viewport.w - hole.left - hole.width),
                height: hole.height,
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className={styles.blockPane}
              style={{
                top: hole.top + hole.height,
                left: 0,
                width: viewport.w,
                height: Math.max(0, viewport.h - hole.top - hole.height),
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.aside
          key={stepId}
          className={`${styles.coach} ${coachPlacement === 'top' ? styles.coachTop : styles.coachBottom}`}
          initial={reduceMotion ? false : { opacity: 0, y: coachPlacement === 'top' ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: coachPlacement === 'top' ? -8 : 8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.coachInner}>
            <div className={styles.progress} aria-hidden="true">
              {Array.from({ length: stepCount }, (_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ''} ${i < stepIndex ? styles.dotDone : ''}`}
                />
              ))}
            </div>

            <p className={styles.kicker}>Paso {stepIndex + 1} de {stepCount}</p>
            <h2 className={styles.title}>{step.title}</h2>
            {step.body ? <p className={styles.body}>{step.body}</p> : null}

            <div className={styles.actions}>
              <button type="button" className={styles.skip} onClick={onSkip}>
                Saltar
              </button>
              {step.primaryLabel ? (
                <button type="button" className={styles.primary} onClick={onPrimary}>
                  {step.primaryLabel}
                </button>
              ) : (
                <span className={styles.hint}>
                  Toca el área iluminada
                  <span className={styles.hintArrow} aria-hidden="true">
                    ↑
                  </span>
                </span>
              )}
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>
    </div>,
    document.body,
  )
}

export default CustomerProductTourOverlay
