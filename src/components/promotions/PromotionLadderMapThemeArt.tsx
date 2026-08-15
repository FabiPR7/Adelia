import type { LadderMapThemeId } from '../../utils/promotionLadderMapThemes'
import styles from './PromotionLadderMapModal.module.css'

interface PromotionLadderMapThemeArtProps {
  themeId: LadderMapThemeId
}

export default function PromotionLadderMapThemeArt({ themeId }: PromotionLadderMapThemeArtProps) {
  return (
    <svg
      className={styles.themeArt}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {themeId === 'island' ? <IslandArt /> : null}
      {themeId === 'volcano' ? <VolcanoArt /> : null}
      {themeId === 'forest' ? <ForestArt /> : null}
      {themeId === 'desert' ? <DesertArt /> : null}
      {themeId === 'space' ? <SpaceArt /> : null}
    </svg>
  )
}

function IslandArt() {
  return (
    <>
      <ellipse cx="18" cy="92" rx="14" ry="5" fill="rgba(255,255,255,0.15)" />
      <ellipse cx="82" cy="88" rx="10" ry="4" fill="rgba(255,255,255,0.12)" />
      <path d="M8 95 Q25 90 42 95 T75 93 T95 96" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <path d="M5 98 Q30 93 55 98 T92 95" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <ellipse cx="50" cy="58" rx="38" ry="32" fill="rgba(90, 173, 56, 0.35)" />
      <ellipse cx="50" cy="62" rx="34" ry="26" fill="rgba(61, 143, 40, 0.25)" />
      <path d="M12 78 L18 62 L24 78 Z" fill="#2d6a4f" opacity="0.7" />
      <path d="M78 72 L84 58 L90 72 Z" fill="#2d6a4f" opacity="0.6" />
      <circle cx="14" cy="82" r="2.5" fill="#228b22" opacity="0.8" />
      <path d="M14 82 L14 76 M11 79 L17 79" stroke="#1a5c1a" strokeWidth="0.6" />
      <circle cx="86" cy="68" r="2" fill="#228b22" opacity="0.7" />
      <path d="M86 68 L86 63 M83 66 L89 66" stroke="#1a5c1a" strokeWidth="0.5" />
      <path d="M6 88 L6 82 L10 85 L14 80 L18 86 L22 81 L26 88 Z" fill="#8b4513" opacity="0.5" />
      <path d="M88 12 L92 8 L96 14 L90 16 Z" fill="#fff" opacity="0.5" />
      <path d="M4 90 L8 86 L12 90 L8 94 Z" fill="rgba(255,255,255,0.4)" />
    </>
  )
}

function VolcanoArt() {
  return (
    <>
      <ellipse cx="50" cy="95" rx="45" ry="8" fill="rgba(255,80,0,0.15)" />
      <path d="M25 95 L50 25 L75 95 Z" fill="#3d2b1f" opacity="0.85" />
      <path d="M35 95 L50 35 L65 95 Z" fill="#5c4033" opacity="0.7" />
      <ellipse cx="50" cy="38" rx="8" ry="4" fill="#ff4500" opacity="0.9" />
      <ellipse cx="50" cy="36" rx="5" ry="2.5" fill="#ffd700" opacity="0.8" />
      <path d="M42 30 Q50 18 58 30 Q54 28 50 26 Q46 28 42 30" fill="rgba(80,80,80,0.6)" />
      <path d="M38 22 Q50 8 62 22" fill="none" stroke="rgba(120,120,120,0.5)" strokeWidth="1.5" />
      <path d="M45 18 Q50 10 55 18" fill="none" stroke="rgba(150,150,150,0.4)" strokeWidth="1" />
      <circle cx="15" cy="75" r="4" fill="#2d2d2d" opacity="0.6" />
      <circle cx="85" cy="70" r="5" fill="#2d2d2d" opacity="0.5" />
      <path d="M10 88 L18 80 L26 88 L18 92 Z" fill="#4a3728" opacity="0.7" />
      <circle cx="8" cy="20" r="1" fill="#ff6b35" opacity="0.8" />
      <circle cx="92" cy="35" r="0.8" fill="#ff4500" opacity="0.7" />
      <circle cx="85" cy="15" r="0.6" fill="#ffd700" opacity="0.6" />
    </>
  )
}

function ForestArt() {
  return (
    <>
      <path d="M0 70 Q20 65 35 72 Q50 68 65 74 Q80 70 100 75 L100 100 L0 100 Z" fill="rgba(45,90,50,0.4)" />
      <path d="M8 55 L12 42 L16 55 Z" fill="#2d5a27" opacity="0.85" />
      <path d="M6 55 L14 55" stroke="#1a3d1a" strokeWidth="0.5" />
      <path d="M22 48 L26 35 L30 48 Z" fill="#3d7a45" opacity="0.8" />
      <path d="M20 48 L32 48" stroke="#1a3d1a" strokeWidth="0.5" />
      <path d="M75 52 L79 38 L83 52 Z" fill="#2d5a27" opacity="0.75" />
      <path d="M88 60 L92 46 L96 60 Z" fill="#3d7a45" opacity="0.7" />
      <path d="M40 65 L44 50 L48 65 Z" fill="#556b2f" opacity="0.65" />
      <ellipse cx="55" cy="78" rx="3" ry="2" fill="#8b4513" opacity="0.6" />
      <ellipse cx="56" cy="76" rx="2.5" ry="1.5" fill="#cd5c5c" opacity="0.5" />
      <path d="M30 85 Q50 80 70 88" fill="none" stroke="rgba(100,160,200,0.4)" strokeWidth="1.2" />
      <circle cx="12" cy="72" r="1.5" fill="#9acd32" opacity="0.7" />
      <circle cx="18" cy="78" r="1" fill="#6b8e23" opacity="0.6" />
    </>
  )
}

function DesertArt() {
  return (
    <>
      <circle cx="85" cy="15" r="10" fill="rgba(255,220,100,0.5)" />
      <circle cx="85" cy="15" r="7" fill="rgba(255,200,50,0.4)" />
      <path d="M0 75 Q25 68 50 75 Q75 82 100 74 L100 100 L0 100 Z" fill="rgba(210,160,80,0.35)" />
      <path d="M0 82 Q30 76 60 84 Q85 78 100 85 L100 100 L0 100 Z" fill="rgba(180,130,60,0.25)" />
      <path d="M12 70 L16 55 L20 70 Z" fill="#228b22" opacity="0.7" />
      <ellipse cx="16" cy="52" rx="3" ry="2" fill="#2d5a27" opacity="0.6" />
      <path d="M14 70 L18 70" stroke="#8b4513" strokeWidth="0.4" />
      <path d="M78 65 L82 50 L86 65 Z" fill="#228b22" opacity="0.65" />
      <path d="M88 58 L92 45 L96 58 L92 62 Z" fill="#c9956a" opacity="0.7" />
      <path d="M90 45 L94 38 L98 45 L94 48 Z" fill="#d4a056" opacity="0.6" />
      <ellipse cx="25" cy="88" rx="8" ry="3" fill="rgba(100,180,220,0.25)" />
      <path d="M5 92 L15 88 L25 92" fill="none" stroke="rgba(100,180,220,0.3)" strokeWidth="0.5" />
    </>
  )
}

function SpaceArt() {
  const stars = [
    [12, 11], [28, 28], [45, 45], [62, 62], [78, 78], [92, 92],
    [8, 35], [35, 55], [55, 70], [88, 22], [22, 82], [48, 18],
    [65, 38], [95, 58], [5, 65], [40, 88], [58, 12], [82, 48],
  ]

  return (
    <>
      {stars.map(([x, y], index) => (
        <circle
          key={`star-${x}-${y}`}
          cx={x}
          cy={y}
          r={index % 3 === 0 ? 0.6 : 0.35}
          fill="#fff"
          opacity={0.4 + (index % 5) * 0.12}
        />
      ))}
      <circle cx="18" cy="22" r="6" fill="#ff6b9d" opacity="0.55" />
      <ellipse cx="18" cy="22" rx="9" ry="2" fill="none" stroke="#ff6b9d" opacity="0.3" strokeWidth="0.5" transform="rotate(-20 18 22)" />
      <circle cx="82" cy="35" r="8" fill="#6b5bff" opacity="0.5" />
      <ellipse cx="82" cy="35" rx="12" ry="3" fill="none" stroke="#9d8df1" opacity="0.35" strokeWidth="0.5" transform="rotate(25 82 35)" />
      <circle cx="75" cy="78" r="4" fill="#00d4ff" opacity="0.45" />
      <circle cx="30" cy="65" r="3" fill="#ffd700" opacity="0.4" />
      <path d="M5 50 L12 48 L10 55 L5 52 Z" fill="rgba(200,200,255,0.3)" />
      <path d="M92 60 L98 58 L96 65 L92 63 Z" fill="rgba(200,200,255,0.25)" />
    </>
  )
}
