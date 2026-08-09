import type { CSSProperties } from 'react'
import { motion, type Variants } from 'framer-motion'
import { getStripEmblem, getStripTitleArt } from '../../utils/levelRankingStripAssets'
import { getLevelProfileBadgeTheme } from '../../utils/levelProfileBadgeThemes'
import EpicBubbleFrame from './EpicBubbleFrame'
import styles from './FriendProfileLevelBadge.module.css'

interface FriendProfileLevelBadgeProps {
  level: number
  levelTitle: string
}

const badgeRise: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 340, damping: 24, delay: 0.12 },
  },
}

function FriendProfileLevelBadge({ level, levelTitle }: FriendProfileLevelBadgeProps) {
  const badgeTheme = getLevelProfileBadgeTheme(level)
  const emblem = getStripEmblem(level)
  const titleArt = getStripTitleArt(level)
  const animationClass = badgeTheme.animation ? styles[`anim${badgeTheme.animation.charAt(0).toUpperCase()}${badgeTheme.animation.slice(1)}`] : ''

  return (
    <motion.div
      className={`${styles.badgeWrap} ${styles[`level${level}`]} ${animationClass}`}
      variants={badgeRise}
      initial="hidden"
      animate="show"
      style={
        {
          '--badge-frame': badgeTheme.frameGradient,
          '--badge-inner': badgeTheme.innerBg,
          '--badge-emblem-glow': badgeTheme.emblemGlow,
        } as CSSProperties
      }
    >
      <EpicBubbleFrame
        ornament={badgeTheme.ornament}
        level={level}
        sparkles={level === 11}
        aria-label={`Nivel ${level}, ${levelTitle}. ${badgeTheme.tagline}`}
        innerClassName={styles.badgeInner}
      >
        <div className={styles.emblemCol}>
          <span className={styles.emblemAura} aria-hidden="true" />
          <span className={styles.emblemRing} aria-hidden="true" />
          <img src={emblem} alt="" className={styles.emblemArt} draggable={false} />
          <span className={styles.levelMedallion}>
            <span className={styles.levelMedLabel}>Nivel</span>
            <strong className={styles.levelMedNumber}>{level}</strong>
          </span>
        </div>

        <div className={styles.titleCol}>
          <img src={titleArt} alt="" className={styles.titleArtBg} draggable={false} aria-hidden="true" />
          <div className={styles.titleStack}>
            <span className="epicEyebrow">Rango alcanzado</span>
            <span className={`epicHeadline ${styles.titleText}`}>{levelTitle}</span>
            <span className="epicTagline">
              <span className="epicTaglineDot" aria-hidden="true" />
              {badgeTheme.tagline}
              <span className="epicTaglineDot" aria-hidden="true" />
            </span>
          </div>
        </div>
      </EpicBubbleFrame>
    </motion.div>
  )
}

export default FriendProfileLevelBadge
