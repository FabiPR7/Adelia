import type { CSSProperties } from 'react'
import { getStripBackground, getStripEmblem } from '../utils/levelRankingStripAssets'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { getLevelProfileCanvas } from '../utils/levelProfileCanvas'
import { getLevelProfileBodyTheme } from '../utils/levelProfileBodyThemes'
import { getLevelProfileBadgeTheme } from '../utils/levelProfileBadgeThemes'
import { getLevelUpCelebrationTheme } from '../utils/levelUpCelebrationThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './LevelUpHeroCard.module.css'

interface LevelUpHeroCardProps {
  level: number
  levelTitle: string
  displayName: string
  handle?: string
  photoUrl?: string
  xp: number
  reveal?: boolean
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function LevelUpHeroCard({
  level,
  levelTitle,
  displayName,
  handle,
  photoUrl,
  xp,
  reveal = false,
}: LevelUpHeroCardProps) {
  const strip = getLevelRankingStripTheme(level)
  const canvas = getLevelProfileCanvas(level)
  const pills = getLevelProfileBodyTheme(level)
  const badge = getLevelProfileBadgeTheme(level)
  const fx = getLevelUpCelebrationTheme(level)
  const scene = getStripBackground(level)
  const emblem = getStripEmblem(level)

  const cssVars = {
    '--lu-border': strip.cardBorder,
    '--lu-name': strip.nameColor,
    '--lu-title': strip.titleColor,
    '--lu-avatar-border': strip.avatarBorder,
    '--lu-xp-fill': strip.xpFill,
    '--lu-pill-num-bg': pills.pillNumberBg,
    '--lu-pill-num-color': pills.pillNumberColor,
    '--lu-pill-title-bg': pills.pillTitleBg,
    '--lu-pill-title-color': pills.pillTitleColor,
    '--lu-scene-pos': canvas.heroObjectPosition,
    '--lu-accent': fx.accent,
  } as CSSProperties

  return (
    <article
      className={`${styles.card} ${reveal ? styles.reveal : ''} ${fx.foil ? styles.hasFoil : ''} ${fx.rays ? styles.hasRays : ''}`}
      style={cssVars}
      aria-label={`${displayName}, nivel ${level} ${levelTitle}`}
    >
      <img
        src={scene}
        alt=""
        className={styles.scene}
        draggable={false}
        decoding="async"
      />
      <div className={styles.sceneShade} aria-hidden="true" />
      {fx.rays ? <div className={styles.rays} aria-hidden="true" /> : null}
      {fx.foil ? <div className={styles.foil} aria-hidden="true" /> : null}

      <div className={styles.emblemWrap}>
        <span className={styles.emblemGlow} aria-hidden="true" />
        <img src={emblem} alt="" className={styles.emblem} draggable={false} />
      </div>

      <div className={styles.body}>
        <div className={styles.avatar}>
          {photoUrl ? (
            <img
              src={optimizeCloudinaryUrl(photoUrl, CLOUDINARY_DISPLAY.logo)}
              alt=""
              className={styles.avatarPhoto}
              decoding="async"
            />
          ) : (
            <span className={styles.avatarInitials}>{initials(displayName)}</span>
          )}
        </div>

        <p className={styles.name}>{displayName}</p>
        {handle ? <p className={styles.handle}>{handle}</p> : null}

        <div className={styles.pills}>
          <span className={styles.levelNum}>NIVEL {level}</span>
          <span className={styles.levelTitle}>{levelTitle}</span>
        </div>

        <p className={styles.tagline}>{badge.tagline}</p>
        <p className={styles.xp}>{xp.toLocaleString('es-ES')} XP</p>
      </div>
    </article>
  )
}

export default LevelUpHeroCard
