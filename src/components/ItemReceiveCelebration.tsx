import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  getInventoryItem,
  rarityLabel,
  type InventoryRarity,
} from '../data/inventoryItems'
import InventoryItemCard from './InventoryItemCard'
import styles from './ItemReceiveCelebration.module.css'

interface ItemReceiveCelebrationProps {
  open: boolean
  itemId: string
  quantity?: number
  title?: string
  preview?: boolean
  onDismiss: () => void
  onPreviewCycle?: (delta: -1 | 1) => void
  previewLabel?: string
}

type Phase = 'intro' | 'impact' | 'settle'

type RarityFx = {
  spins: number
  scaleSpring: Transition
  spinSpring: Transition
  flipSpring?: Transition
  useFlip: boolean
  ctaDelay: number
  burstCount: number
  ambientCount: number
  rings: number
  showRays: boolean
  showSheen: boolean
  showOrbit: boolean
  showFlash: boolean
  showEmbers: boolean
  showAurora: boolean
  idleFloat: boolean
}

const FX: Record<InventoryRarity, RarityFx> = {
  white: {
    spins: 720,
    scaleSpring: { type: 'spring', stiffness: 210, damping: 16, mass: 0.85 },
    spinSpring: { type: 'spring', stiffness: 70, damping: 12, mass: 0.9 },
    useFlip: false,
    ctaDelay: 0.58,
    burstCount: 0,
    ambientCount: 5,
    rings: 0,
    showRays: false,
    showSheen: false,
    showOrbit: false,
    showFlash: false,
    showEmbers: false,
    showAurora: false,
    idleFloat: false,
  },
  copper: {
    spins: 540,
    scaleSpring: { type: 'spring', stiffness: 175, damping: 13, mass: 1 },
    spinSpring: { type: 'spring', stiffness: 58, damping: 11, mass: 1.05 },
    useFlip: false,
    ctaDelay: 0.72,
    burstCount: 10,
    ambientCount: 9,
    rings: 1,
    showRays: false,
    showSheen: false,
    showOrbit: false,
    showFlash: true,
    showEmbers: true,
    showAurora: false,
    idleFloat: true,
  },
  silver: {
    spins: 900,
    scaleSpring: { type: 'spring', stiffness: 255, damping: 14, mass: 0.75 },
    spinSpring: { type: 'spring', stiffness: 82, damping: 10, mass: 0.8 },
    useFlip: false,
    ctaDelay: 0.78,
    burstCount: 14,
    ambientCount: 8,
    rings: 2,
    showRays: false,
    showSheen: true,
    showOrbit: false,
    showFlash: true,
    showEmbers: false,
    showAurora: false,
    idleFloat: true,
  },
  gold: {
    spins: 1080,
    scaleSpring: { type: 'spring', stiffness: 145, damping: 11, mass: 1.1 },
    spinSpring: { type: 'spring', stiffness: 48, damping: 9.5, mass: 1.1 },
    useFlip: false,
    ctaDelay: 0.9,
    burstCount: 18,
    ambientCount: 14,
    rings: 2,
    showRays: true,
    showSheen: true,
    showOrbit: false,
    showFlash: true,
    showEmbers: false,
    showAurora: false,
    idleFloat: true,
  },
  azure: {
    spins: 1440,
    scaleSpring: { type: 'spring', stiffness: 120, damping: 11, mass: 1.25 },
    spinSpring: { type: 'spring', stiffness: 36, damping: 10, mass: 1.3 },
    flipSpring: { type: 'spring', stiffness: 72, damping: 12, mass: 1.05 },
    useFlip: true,
    ctaDelay: 1.15,
    burstCount: 24,
    ambientCount: 18,
    rings: 4,
    showRays: true,
    showSheen: true,
    showOrbit: true,
    showFlash: true,
    showEmbers: false,
    showAurora: true,
    idleFloat: true,
  },
  ash: {
    spins: 480,
    scaleSpring: { type: 'spring', stiffness: 165, damping: 17, mass: 1.05 },
    spinSpring: { type: 'spring', stiffness: 55, damping: 14, mass: 1.05 },
    useFlip: false,
    ctaDelay: 0.7,
    burstCount: 8,
    ambientCount: 10,
    rings: 1,
    showRays: false,
    showSheen: false,
    showOrbit: false,
    showFlash: false,
    showEmbers: false,
    showAurora: false,
    idleFloat: true,
  },
}

function seededBits(count: number, seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Array.from({ length: count }, (_, index) => {
    h = Math.imul(h ^ (index + 1), 16777619) >>> 0
    const n = h / 0xffffffff
    const n2 = ((h >>> 8) % 1000) / 1000
    const n3 = ((h >>> 16) % 1000) / 1000
    return { index, n, n2, n3 }
  })
}

function burstStyle(
  bit: { index: number; n: number; n2: number; n3: number },
  total: number,
  rarity: InventoryRarity,
): CSSProperties {
  const angle = (360 / Math.max(total, 1)) * bit.index + bit.n * 18
  const distance = (rarity === 'gold' || rarity === 'azure' ? 78 : 56) + bit.n2 * 40
  const size = (rarity === 'azure' ? 6 : rarity === 'gold' ? 5.5 : rarity === 'silver' ? 4.2 : 3.8) + bit.n3 * 3.5
  const delay = 0.08 + bit.n * 0.22
  return {
    '--burst-angle': `${angle}deg`,
    '--burst-distance': `${distance}px`,
    '--burst-size': `${size}px`,
    '--burst-delay': `${delay}s`,
    '--burst-spin': `${bit.n2 > 0.5 ? 1 : -1}`,
  } as CSSProperties
}

function ambientStyle(
  bit: { index: number; n: number; n2: number; n3: number },
  rarity: InventoryRarity,
): CSSProperties {
  const left = 8 + bit.n * 84
  const size = (rarity === 'gold' || rarity === 'azure' ? 0.3 : 0.18) + bit.n2 * 0.35
  const delay = bit.n3 * 1.4
  const duration = (rarity === 'ash' ? 3.2 : rarity === 'copper' ? 2.1 : rarity === 'azure' ? 2.2 : 2.6) + bit.n * 1.4
  const drift = (bit.n2 - 0.5) * (rarity === 'azure' ? 56 : 28)
  return {
    left: `${left}%`,
    width: `${size}rem`,
    height: `${size}rem`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    ['--drift' as string]: `${drift}px`,
  }
}

function ItemReceiveCelebration({
  open,
  itemId,
  quantity = 1,
  title = '¡Recompensa!',
  preview = false,
  onDismiss,
  onPreviewCycle,
  previewLabel,
}: ItemReceiveCelebrationProps) {
  const reducedMotion = useReducedMotion()
  const item = getInventoryItem(itemId)
  const [phase, setPhase] = useState<Phase>('intro')

  useEffect(() => {
    if (!open || !preview || !onPreviewCycle) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPreviewCycle(-1)
      if (event.key === 'ArrowRight') onPreviewCycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, preview, onPreviewCycle])

  useEffect(() => {
    if (!open || !item) {
      setPhase('intro')
      return
    }

    setPhase('intro')
    if (reducedMotion) {
      setPhase('settle')
      return
    }

    const timers = [
      window.setTimeout(() => setPhase('impact'), item.rarity === 'azure' ? 280 : 220),
      window.setTimeout(() => setPhase('settle'), item.rarity === 'azure' ? 980 : 780),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [open, item, itemId, reducedMotion])

  const fx = useMemo(
    () => (item ? FX[item.rarity] : FX.white),
    [item],
  )

  const bursts = useMemo(
    () => (item && !reducedMotion ? seededBits(fx.burstCount, `${itemId}:burst`) : []),
    [fx.burstCount, item, itemId, reducedMotion],
  )

  const ambients = useMemo(
    () => (item && !reducedMotion ? seededBits(fx.ambientCount, `${itemId}:ambient`) : []),
    [fx.ambientCount, item, itemId, reducedMotion],
  )

  const embers = useMemo(
    () => (item && fx.showEmbers && !reducedMotion ? seededBits(7, `${itemId}:ember`) : []),
    [fx.showEmbers, item, itemId, reducedMotion],
  )

  if (!item) {
    return null
  }

  const rarity = item.rarity
  const settled = phase === 'settle'
  const impacted = phase === 'impact' || phase === 'settle'
  const isEpic = rarity === 'azure'

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`${styles.overlay} ${styles[`rarity_${rarity}`]} ${isEpic ? styles.epicMode : ''}`}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={
            impacted && isEpic && !reducedMotion
              ? { opacity: 1, x: [0, -3, 3, -2, 2, 0] }
              : { opacity: 1, x: 0 }
          }
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.24, ease: 'easeOut' },
            x: isEpic && impacted ? { duration: 0.42, ease: 'easeOut' } : { duration: 0 },
          }}
        >
          <button
            type="button"
            className={styles.scrim}
            aria-label="Cerrar"
            onClick={onDismiss}
          />

          <div className={`${styles.vignette} ${impacted ? styles.vignetteHot : ''}`} aria-hidden="true" />

          {isEpic && !reducedMotion ? (
            <div key={`${itemId}-beams`} className={styles.beamField} aria-hidden="true">
              <span className={styles.beam} />
              <span className={`${styles.beam} ${styles.beamAlt}`} />
              <span className={`${styles.beam} ${styles.beamMid}`} />
            </div>
          ) : null}

          {ambients.length > 0 ? (
            <div key={`${itemId}-ambient`} className={styles.ambientLayer} aria-hidden="true">
              {ambients.map((bit) => (
                <span
                  key={bit.index}
                  className={`${styles.ambient} ${styles[`ambient_${rarity}`]}`}
                  style={ambientStyle(bit, rarity)}
                />
              ))}
            </div>
          ) : null}

          <motion.div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-receive-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {preview && onPreviewCycle ? (
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => onPreviewCycle(-1)}
                  aria-label="Rareza anterior"
                >
                  ‹
                </button>
                <span>{previewLabel ?? rarityLabel(rarity)}</span>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => onPreviewCycle(1)}
                  aria-label="Siguiente rareza"
                >
                  ›
                </button>
              </div>
            ) : preview ? (
              <p className={styles.previewTag}>Vista previa</p>
            ) : null}

            <motion.p
              key={`${itemId}-headline`}
              className={styles.headline}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            >
              {title}
            </motion.p>

            <motion.p
              key={`${itemId}-chip`}
              className={`${styles.rarityChip} ${isEpic ? styles.rarityChipEpic : ''}`}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
            >
              {rarityLabel(rarity)}
            </motion.p>

            <div key={itemId} className={`${styles.stage} ${isEpic ? styles.stageEpic : ''}`}>
              {fx.showAurora && !reducedMotion ? (
                <motion.div
                  className={styles.aurora}
                  aria-hidden="true"
                  initial={{ opacity: 0, scaleY: 0.4 }}
                  animate={{ opacity: settled ? 1 : 0.5, scaleY: 1 }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                />
              ) : null}

              {isEpic && !reducedMotion ? (
                <motion.div
                  className={styles.epicHalo}
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: settled ? [0.55, 0.95, 0.55] : 0.4,
                    scale: settled ? [1, 1.12, 1] : 1,
                    rotate: settled ? 360 : 0,
                  }}
                  transition={
                    settled
                      ? {
                          opacity: { duration: 2.4, ease: 'easeInOut', repeat: Infinity },
                          scale: { duration: 2.4, ease: 'easeInOut', repeat: Infinity },
                          rotate: { duration: 18, ease: 'linear', repeat: Infinity },
                        }
                      : { duration: 0.6, ease: 'easeOut' }
                  }
                />
              ) : null}

              {fx.showRays && !reducedMotion ? (
                <motion.div
                  className={`${styles.rays} ${isEpic ? styles.raysEpic : ''}`}
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.55, rotate: -28 }}
                  animate={{
                    opacity: settled ? 1 : 0.55,
                    scale: isEpic ? 1.15 : 1,
                    rotate: settled ? (isEpic ? 48 : 28) : 0,
                  }}
                  transition={{
                    opacity: { duration: 0.45, ease: 'easeOut' },
                    scale: { duration: 0.55, ease: 'easeOut' },
                    rotate: settled
                      ? { duration: isEpic ? 10 : 14, ease: 'linear', repeat: Infinity }
                      : { duration: 0.7, ease: 'easeOut' },
                  }}
                />
              ) : null}

              {Array.from({ length: fx.rings }, (_, ringIndex) => (
                <motion.div
                  key={`ring-${ringIndex}`}
                  className={`${styles.ring} ${isEpic ? styles.ringEpic : ''}`}
                  aria-hidden="true"
                  initial={{ opacity: 0.95, scale: 0.22 }}
                  animate={impacted ? { opacity: 0, scale: 1.85 + ringIndex * 0.4 } : { opacity: 0, scale: 0.22 }}
                  transition={{
                    duration: 0.75 + ringIndex * 0.14,
                    ease: 'easeOut',
                    delay: 0.04 + ringIndex * 0.09,
                  }}
                />
              ))}

              {fx.showOrbit && !reducedMotion ? (
                <>
                  <motion.div
                    className={styles.orbit}
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: settled ? 1 : 0.45, rotate: 360 }}
                    transition={{
                      opacity: { duration: 0.35 },
                      rotate: { duration: isEpic ? 4.2 : 5.5, ease: 'linear', repeat: Infinity },
                    }}
                  >
                    <span className={styles.orbitDot} />
                    <span className={`${styles.orbitDot} ${styles.orbitDotB}`} />
                    <span className={`${styles.orbitDot} ${styles.orbitDotC}`} />
                  </motion.div>
                  {isEpic ? (
                    <motion.div
                      className={`${styles.orbit} ${styles.orbitReverse}`}
                      aria-hidden="true"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: settled ? 0.85 : 0.3, rotate: -360 }}
                      transition={{
                        opacity: { duration: 0.4, delay: 0.15 },
                        rotate: { duration: 7.5, ease: 'linear', repeat: Infinity },
                      }}
                    >
                      <span className={`${styles.orbitDot} ${styles.orbitDotWide}`} />
                      <span className={`${styles.orbitDot} ${styles.orbitDotWideB}`} />
                    </motion.div>
                  ) : null}
                </>
              ) : null}

              <motion.div
                className={styles.glow}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.35 }}
                animate={{
                  opacity: settled ? 1 : 0.7,
                  scale: settled && fx.idleFloat ? [1, isEpic ? 1.14 : 1.08, 1] : 1,
                }}
                transition={
                  settled && fx.idleFloat && !reducedMotion
                    ? {
                        opacity: { duration: 0.4 },
                        scale: { duration: isEpic ? 1.8 : 2.4, ease: 'easeInOut', repeat: Infinity },
                      }
                    : { duration: 0.5, ease: 'easeOut', delay: 0.06 }
                }
              />

              <motion.div
                className={styles.floor}
                aria-hidden="true"
                initial={{ opacity: 0, scaleX: 0.4 }}
                animate={{ opacity: settled ? 0.9 : 0.35, scaleX: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut', delay: 0.18 }}
              />

              {fx.showFlash && !reducedMotion ? (
                <motion.div
                  className={styles.flash}
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.2 }}
                  animate={impacted ? { opacity: [0, 1, 0], scale: [0.15, 1.5, 2.1] } : { opacity: 0 }}
                  transition={{ duration: isEpic ? 0.7 : 0.55, ease: 'easeOut' }}
                />
              ) : null}

              {isEpic && impacted && !reducedMotion ? (
                <motion.div
                  className={styles.epicShock}
                  aria-hidden="true"
                  initial={{ opacity: 0.9, scale: 0.3 }}
                  animate={{ opacity: 0, scale: 2.6 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                />
              ) : null}

              {bursts.map((bit) => (
                <span
                  key={`burst-${bit.index}`}
                  className={`${styles.burst} ${styles[`burst_${rarity}`]}`}
                  style={burstStyle(bit, bursts.length, rarity)}
                  aria-hidden="true"
                />
              ))}

              {embers.map((bit) => (
                <span
                  key={`ember-${bit.index}`}
                  className={styles.ember}
                  style={{
                    left: `${28 + bit.n * 44}%`,
                    animationDelay: `${0.15 + bit.n2 * 0.55}s`,
                    animationDuration: `${1.4 + bit.n3 * 0.9}s`,
                    ['--ember-x' as string]: `${(bit.n - 0.5) * 36}px`,
                  }}
                  aria-hidden="true"
                />
              ))}

              <motion.div
                className={styles.cardWrap}
                initial={
                  reducedMotion
                    ? { opacity: 0, scale: 0.92 }
                    : fx.useFlip
                      ? { opacity: 0, scale: 0.04, rotate: -56, rotateY: -130 }
                      : { opacity: 0, scale: 0.12, rotate: -28 }
                }
                animate={
                  reducedMotion
                    ? { opacity: 1, scale: 1 }
                    : fx.useFlip
                      ? { opacity: 1, scale: 1, rotate: fx.spins, rotateY: 0 }
                      : { opacity: 1, scale: 1, rotate: fx.spins }
                }
                transition={
                  reducedMotion
                    ? { duration: 0.28, ease: 'easeOut' }
                    : {
                        opacity: { duration: 0.18, ease: 'easeOut' },
                        scale: fx.scaleSpring,
                        rotate: fx.spinSpring,
                        rotateY: fx.flipSpring,
                      }
                }
              >
                <div className={settled && fx.idleFloat && !reducedMotion ? styles.cardFloat : undefined}>
                  <InventoryItemCard item={item} quantity={quantity} featured />
                  {fx.showSheen && !reducedMotion ? (
                    <motion.span
                      className={styles.cardSheen}
                      aria-hidden="true"
                      initial={{ x: '-130%', opacity: 0 }}
                      animate={{ x: '145%', opacity: [0, 1, 0.2, 0] }}
                      transition={{
                        duration: rarity === 'gold' || isEpic ? 0.9 : 0.65,
                        ease: 'easeInOut',
                        delay: 0.38,
                      }}
                    />
                  ) : null}
                  {isEpic && settled && !reducedMotion ? (
                    <motion.span
                      className={`${styles.cardSheen} ${styles.cardSheenSecond}`}
                      aria-hidden="true"
                      initial={{ x: '-130%', opacity: 0 }}
                      animate={{ x: '145%', opacity: [0, 0.8, 0] }}
                      transition={{
                        duration: 0.75,
                        ease: 'easeInOut',
                        delay: 1.1,
                        repeat: Infinity,
                        repeatDelay: 2.2,
                      }}
                    />
                  ) : null}
                </div>
              </motion.div>

              {rarity === 'gold' && settled && !reducedMotion ? (
                <motion.div
                  className={styles.goldBloom}
                  aria-hidden="true"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
                />
              ) : null}

              {isEpic && settled && !reducedMotion ? (
                <motion.div
                  className={styles.epicBloom}
                  aria-hidden="true"
                  animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.92, 1.1, 0.92] }}
                  transition={{ duration: 1.9, ease: 'easeInOut', repeat: Infinity }}
                />
              ) : null}
            </div>

            <motion.div
              key={`${itemId}-copy`}
              className={styles.itemCopy}
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{
                opacity: settled || reducedMotion ? 1 : 0,
                y: settled || reducedMotion ? 0 : 10,
              }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: reducedMotion ? 0 : 0.12 }}
            >
              <h2 id="item-receive-title" className={styles.title}>
                {item.name}
              </h2>
              <p className={styles.subtitle}>{item.description}</p>
            </motion.div>

            <motion.button
              type="button"
              className={styles.cta}
              onClick={onDismiss}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: reducedMotion ? 0.05 : fx.ctaDelay,
                duration: 0.32,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {preview ? 'Cerrar' : '¡Genial!'}
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export default ItemReceiveCelebration
