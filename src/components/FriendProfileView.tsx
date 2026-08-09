import { useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { getGamificationLevelTitle } from '../data/gamificationLevels'
import { getFriendEarnedAchievements } from '../utils/friendAchievementProgress'
import { getLevelProfileBackground } from '../utils/levelProfileBackground'
import { getLevelProfileBodyTheme } from '../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { getLevelProfileBadgeTheme } from '../utils/levelProfileBadgeThemes'
import { LEVEL1_PROFILE } from '../utils/level1ProfileTheme'
import { getStripEmblem, getStripTitleArt } from '../utils/levelRankingStripAssets'
import type { FriendProfile } from '../types/friends'
import FriendProfilePanels from './friendProfile/FriendProfilePanels'
import FriendProfileLevelBadge from './friendProfile/FriendProfileLevelBadge'
import Level1ProfileBackdrop from './Level1ProfileBackdrop'
import LevelProfileAmbientEffects from './friendProfile/LevelProfileAmbientEffects'
import styles from './FriendProfileView.module.css'

interface FriendProfileViewProps {
  friend: FriendProfile
  onBack: () => void
}

function FriendProfileView({ friend, onBack }: FriendProfileViewProps) {
  const level = Math.min(12, Math.max(1, friend.level))
  const stripTheme = getLevelRankingStripTheme(level)
  const bodyTheme = getLevelProfileBodyTheme(level)
  const levelBg = getLevelProfileBackground(level)
  const levelEmblem = getStripEmblem(level)
  const titleArt = getStripTitleArt(level)
  const earnedAchievements = useMemo(() => getFriendEarnedAchievements(friend), [friend])
  const levelTitle = getGamificationLevelTitle(level)
  const locationLabel = [friend.homeCity, friend.homeCountry].filter(Boolean).join(' · ')
  const promotionsEstimate = Math.max(0, Math.round(friend.missionsCompleted * 0.65))
  const progressPercent = Math.round(friend.levelProgress * 100)
  const isLevel1 = level === 1
  const badgeTheme = getLevelProfileBadgeTheme(level)

  const themeStyle = {
    ...(isLevel1
      ? {
          '--strip-border': LEVEL1_PROFILE.woodFrame,
          '--strip-name': LEVEL1_PROFILE.brownText,
          '--strip-title': LEVEL1_PROFILE.brownMuted,
          '--strip-name-shadow': '0 1px 2px rgba(255, 255, 255, 0.6)',
          '--strip-xp-track': LEVEL1_PROFILE.xpTrack,
          '--strip-xp-fill': LEVEL1_PROFILE.xpFill,
          '--strip-xp-label': LEVEL1_PROFILE.brownDark,
          '--strip-avatar-border': LEVEL1_PROFILE.avatarBorder,
          '--pill-number-bg': LEVEL1_PROFILE.pillNumberBg,
          '--pill-number-color': '#fff8ef',
          '--pill-title-bg': LEVEL1_PROFILE.pillTitleBg,
          '--pill-title-color': LEVEL1_PROFILE.brownText,
          '--body-text': LEVEL1_PROFILE.brownText,
          '--body-muted': LEVEL1_PROFILE.brownMuted,
          '--metric-bg': LEVEL1_PROFILE.metricBg,
          '--metric-border': LEVEL1_PROFILE.metricBorder,
          '--chip-bg': LEVEL1_PROFILE.chipBg,
          '--chip-text': LEVEL1_PROFILE.brownDark,
          '--chip-border': LEVEL1_PROFILE.chipBorder,
          '--divider': LEVEL1_PROFILE.divider,
          '--section-accent': LEVEL1_PROFILE.woodDark,
          '--badge-frame': badgeTheme.frameGradient,
          '--badge-inner': badgeTheme.innerBg,
        }
      : {
          '--strip-overlay': stripTheme.overlay,
          '--strip-border': stripTheme.cardBorder,
          '--strip-name': stripTheme.nameColor,
          '--strip-title': stripTheme.titleColor,
          '--strip-name-shadow': stripTheme.nameShadow,
          '--strip-xp-track': stripTheme.xpTrack,
          '--strip-xp-fill': stripTheme.xpFill,
          '--strip-xp-label': stripTheme.xpLabelColor,
          '--strip-avatar-border': stripTheme.avatarBorder,
          '--pill-number-bg': bodyTheme.pillNumberBg,
          '--pill-number-color': bodyTheme.pillNumberColor,
          '--pill-title-bg': bodyTheme.pillTitleBg,
          '--pill-title-color': bodyTheme.pillTitleColor,
          '--hero-height': bodyTheme.heroHeight,
          '--hero-object-position': bodyTheme.heroObjectPosition,
          '--body-top': bodyTheme.bodyTop,
          '--body-height': bodyTheme.bodyHeight,
          '--body-object-position': bodyTheme.bodyObjectPosition,
          '--page-glow': bodyTheme.pageGlow,
          '--page-vignette': bodyTheme.pageVignette,
          '--body-text': stripTheme.nameColor,
          '--body-muted': stripTheme.titleColor,
          '--metric-bg': bodyTheme.metricBg,
          '--metric-border': bodyTheme.metricBorder,
          '--chip-bg': bodyTheme.chipBg,
          '--chip-text': bodyTheme.chipText,
          '--chip-border': bodyTheme.chipBorder,
          '--divider': bodyTheme.divider,
          '--section-accent': bodyTheme.sectionAccent,
          '--level-bg': `url(${levelBg})`,
          '--badge-frame': badgeTheme.frameGradient,
          '--badge-inner': badgeTheme.innerBg,
        }),
  } as CSSProperties

  return (
    <article className={`${styles.page} ${styles[`level${level}`]} ${isLevel1 ? styles.pageLevel1 : ''}`} style={themeStyle}>
      <div className={styles.pageCanvas} aria-hidden="true">
        {isLevel1 ? (
          <Level1ProfileBackdrop />
        ) : (
          <>
            <img src={levelBg} alt="" className={styles.pageBgHero} draggable={false} />
            <img src={levelBg} alt="" className={styles.pageBgBody} draggable={false} />
            <div className={styles.pageOverlay} />
            <div className={styles.pageGlow} />
            <div className={styles.pageVignette} />
            <div className={styles.pageShine} />
          </>
        )}
      </div>

      {level >= 10 && level <= 12 ? <LevelProfileAmbientEffects level={level} /> : null}

      <header className={`${styles.hero} relative z-10`}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Volver a amigos">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <motion.div
          className={styles.heroInner}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={titleArt} alt="" className={styles.titleArt} draggable={false} aria-hidden="true" />

          <div className={styles.avatarStage}>
            <span className={styles.avatarGlow} aria-hidden="true" />
            <div className={styles.avatarRing}>
              {friend.photoUrl ? (
                <img src={friend.photoUrl} alt="" className={styles.avatar} />
              ) : (
                <span className={styles.avatarFallback}>{friend.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <img src={levelEmblem} alt="" className={styles.levelEmblem} />
          </div>

          <h1 className={styles.displayName}>{friend.displayName}</h1>

          <FriendProfileLevelBadge level={level} levelTitle={levelTitle} />
        </motion.div>
      </header>

      <div className={`${styles.body} relative z-10`}>
        <div className={styles.bodyInner}>
          <FriendProfilePanels
            level={level}
            locationLabel={locationLabel || undefined}
            xp={friend.xp}
            progressPercent={progressPercent}
            reservationsTotal={friend.reservationsTotal}
            promotionsEstimate={promotionsEstimate}
            missionsCompleted={friend.missionsCompleted}
            foodPreferences={friend.foodPreferences}
            earnedAchievements={earnedAchievements}
          />
        </div>
      </div>
    </article>
  )
}

export default FriendProfileView
