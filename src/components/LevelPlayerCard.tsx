import type { CSSProperties } from 'react'
import { getLevelProfileBodyTheme } from '../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { getStripBackground, getStripEmblem } from '../utils/levelRankingStripAssets'
import LevelLaurel from './LevelLaurel'
import styles from './FriendProfileView.module.css'

/**
 * Tarjeta de jugador con la estética de su nivel (igual que las 12 tarjetas de
 * referencia): sala del nivel, doble marco, laurel y aro de su color, escudo,
 * «NIVEL N · rango», XP y progreso. La usan tu perfil y el de tus amigos.
 */
function LevelPlayerCard({
  level: rawLevel,
  levelTitle,
  displayName,
  username,
  photoUrl,
  xp,
  levelProgress,
  location,
}: {
  level: number
  levelTitle: string
  displayName: string
  username?: string
  photoUrl?: string
  xp: number
  levelProgress: number
  location?: string
}) {
  const level = Math.min(12, Math.max(1, rawLevel || 1))
  const strip = getLevelRankingStripTheme(level)
  const body = getLevelProfileBodyTheme(level)
  const progressPercent = Math.round(levelProgress * 100)

  const vars = {
    '--lv-overlay': strip.overlay,
    '--lv-border': strip.cardBorder,
    '--lv-ring': strip.avatarBorder,
    '--lv-name': strip.nameColor,
    '--lv-title': strip.titleColor,
    '--lv-name-shadow': strip.nameShadow,
    '--lv-fill': strip.xpFill,
    '--lv-track': strip.xpTrack,
    '--lv-pill-number-bg': body.pillNumberBg,
    '--lv-pill-number-color': body.pillNumberColor,
    '--lv-pill-title-bg': body.pillTitleBg,
    '--lv-pill-title-color': body.pillTitleColor,
    '--lv-bg': `url(${getStripBackground(level)})`,
  } as CSSProperties

  return (
    <header className={styles.card} style={vars}>
      <span className={styles.cardBg} aria-hidden="true" />
      <span className={styles.cardOverlay} aria-hidden="true" />
      <span className={styles.cardFrame} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />

      <div className={styles.cardTop}>
        <div className={styles.portrait}>
          <LevelLaurel color={strip.avatarBorder} className={styles.laurel} />
          <span className={styles.avatarRing}>
            {photoUrl ? (
              <img src={photoUrl} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback}>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </span>
        </div>
        <img src={getStripEmblem(level)} alt="" className={styles.shield} draggable={false} />
      </div>

      <h1 className={styles.name}>{displayName}</h1>
      {username ? <p className={styles.username}>@{username}</p> : null}
      <span className={styles.divider} aria-hidden="true"><span>✦</span></span>

      <div className={styles.levelRow}>
        <span className={styles.levelPill}>
          <span className={styles.levelNumber}>NIVEL {level}</span>
          <span className={styles.levelTitle}>{levelTitle}</span>
        </span>
        <span className={styles.xpBox}>
          <strong>{xp.toLocaleString('es-ES')}</strong>
          <span>XP</span>
        </span>
      </div>

      <div className={styles.progress}>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${Math.max(4, progressPercent)}%` }} />
        </span>
        <span className={styles.progressText}>
          {level >= 12 ? 'Nivel máximo alcanzado' : `${progressPercent}% para el nivel ${level + 1}`}
        </span>
      </div>
      {location ? <p className={styles.location}>📍 {location}</p> : null}
    </header>
  )
}

export default LevelPlayerCard
