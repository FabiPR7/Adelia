import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { planUpgradeHint } from '../data/companyPlanLimits'
import type { CompanyPlanId } from '../data/companyPlans'
import styles from './PlanLockHint.module.css'

function useOpenCompanyPlan() {
  const [, setSearchParams] = useSearchParams()

  return () => {
    setSearchParams({ tab: 'plan' })
  }
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 10V8a4 4 0 0 1 8 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="6" y="10" width="12" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="15" r="1.15" fill="currentColor" />
    </svg>
  )
}

interface PlanLockCopyProps {
  feature: string
  capabilityId?: string
  requiredPlanId?: CompanyPlanId
  onUpgrade?: () => void
}

function useLockLayer() {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const visible = open || hover

  useLayoutEffect(() => {
    if (!visible || !wrapRef.current) {
      return
    }

    const rect = wrapRef.current.getBoundingClientRect()
    const width = 280
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const top = rect.bottom + 8
    setCoords({ top, left })
  }, [visible])

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const show = () => setHover(true)
  const hide = () => setHover(false)

  return { wrapRef, popoverRef, open, setOpen, visible, coords, show, hide }
}

function LockPopover({
  copy,
  onUpgrade,
  labelledBy,
  coords,
  popoverRef,
  onEnter,
  onLeave,
}: {
  copy: ReturnType<typeof planUpgradeHint>
  onUpgrade: () => void
  labelledBy: string
  coords: { top: number; left: number }
  popoverRef: { current: HTMLDivElement | null }
  onEnter: () => void
  onLeave: () => void
}) {
  return createPortal(
    <div
      ref={popoverRef}
      className={styles.popover}
      role="tooltip"
      id={labelledBy}
      style={{ top: coords.top, left: coords.left }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <p className={styles.popoverTitle}>{copy.title}</p>
      <p className={styles.popoverDetail}>{copy.detail}</p>
      <button type="button" className={styles.popoverCta} onClick={onUpgrade}>
        {copy.cta}
      </button>
    </div>,
    document.body,
  )
}

export function PlanLockHint({
  feature,
  capabilityId,
  requiredPlanId,
  onUpgrade,
}: PlanLockCopyProps) {
  const layer = useLockLayer()
  const tooltipId = useId()
  const goToPlan = useOpenCompanyPlan()
  const copy = planUpgradeHint({ feature, capabilityId, requiredPlanId })
  const handleUpgrade = onUpgrade ?? goToPlan

  return (
    <span
      ref={layer.wrapRef}
      className={styles.hint}
      onMouseEnter={layer.show}
      onMouseLeave={layer.hide}
    >
      <button
        type="button"
        className={styles.lockBtn}
        aria-label={copy.title}
        aria-describedby={tooltipId}
        aria-expanded={layer.open}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          layer.setOpen((current) => !current)
        }}
      >
        <LockGlyph />
      </button>
      {layer.visible && layer.coords ? (
        <LockPopover
          copy={copy}
          onUpgrade={handleUpgrade}
          labelledBy={tooltipId}
          coords={layer.coords}
          popoverRef={layer.popoverRef}
          onEnter={layer.show}
          onLeave={layer.hide}
        />
      ) : null}
    </span>
  )
}

export function LockedControl({
  locked,
  feature,
  capabilityId,
  requiredPlanId,
  onUpgrade,
  variant = 'inline',
  children,
}: PlanLockCopyProps & { locked: boolean; variant?: 'inline' | 'nav'; children: ReactNode }) {
  const layer = useLockLayer()
  const tooltipId = useId()
  const goToPlan = useOpenCompanyPlan()
  const copy = planUpgradeHint({ feature, capabilityId, requiredPlanId })
  const handleUpgrade = onUpgrade ?? goToPlan

  if (!locked) {
    return children
  }

  const intercept = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    layer.setOpen(true)
  }

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{
        onClick?: (event: MouseEvent) => void
        disabled?: boolean
        'aria-disabled'?: boolean
        'aria-describedby'?: string
        className?: string
      }>, {
        onClick: intercept,
        disabled: false,
        'aria-disabled': true,
        'aria-describedby': tooltipId,
        className: [(children as ReactElement<{ className?: string }>).props.className, styles.lockedTarget]
          .filter(Boolean)
          .join(' '),
      })
    : children

  return (
    <span
      ref={layer.wrapRef}
      className={`${styles.control} ${variant === 'nav' ? styles.controlNav : ''} ${layer.open ? styles.hintOpen : ''}`}
      onMouseEnter={layer.show}
      onMouseLeave={layer.hide}
    >
      {child}
      <button
        type="button"
        className={styles.lockBtn}
        aria-label={copy.title}
        aria-expanded={layer.open}
        onClick={intercept}
      >
        <LockGlyph />
      </button>
      {layer.visible && layer.coords ? (
        <LockPopover
          copy={copy}
          onUpgrade={handleUpgrade}
          labelledBy={tooltipId}
          coords={layer.coords}
          popoverRef={layer.popoverRef}
          onEnter={layer.show}
          onLeave={layer.hide}
        />
      ) : null}
    </span>
  )
}

export function PlanLockedPanel({
  feature,
  capabilityId,
  requiredPlanId,
  onUpgrade,
}: PlanLockCopyProps) {
  const goToPlan = useOpenCompanyPlan()
  const copy = planUpgradeHint({ feature, capabilityId, requiredPlanId })

  return (
    <div className={styles.panel}>
      <span className={styles.panelLock} aria-hidden="true">
        <LockGlyph />
      </span>
      <h2>{copy.title}</h2>
      <p>{copy.detail}</p>
      <button type="button" className={styles.popoverCta} onClick={onUpgrade ?? goToPlan}>
        {copy.cta}
      </button>
    </div>
  )
}
