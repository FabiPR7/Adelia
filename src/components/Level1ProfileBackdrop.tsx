import styles from './Level1ProfileBackdrop.module.css'

function LeafBranch({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="l1Wood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8c99a" />
          <stop offset="45%" stopColor="#c4956a" />
          <stop offset="100%" stopColor="#9a7348" />
        </linearGradient>
        <filter id="l1LeafShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#5c4a3a" floodOpacity="0.35" />
        </filter>
      </defs>
      <path
        d="M8 62 C 28 48, 42 28, 58 18 C 72 10, 88 8, 102 12"
        fill="none"
        stroke="url(#l1Wood)"
        strokeWidth="4.5"
        strokeLinecap="round"
        filter="url(#l1LeafShadow)"
      />
      <ellipse cx="34" cy="44" rx="11" ry="6" transform="rotate(-35 34 44)" fill="url(#l1Wood)" filter="url(#l1LeafShadow)" />
      <ellipse cx="52" cy="28" rx="12" ry="6.5" transform="rotate(-20 52 28)" fill="url(#l1Wood)" filter="url(#l1LeafShadow)" />
      <ellipse cx="72" cy="18" rx="11" ry="6" transform="rotate(-8 72 18)" fill="url(#l1Wood)" filter="url(#l1LeafShadow)" />
      <ellipse cx="90" cy="14" rx="10" ry="5.5" transform="rotate(12 90 14)" fill="url(#l1Wood)" filter="url(#l1LeafShadow)" />
    </svg>
  )
}

function LeafWreath({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 120" aria-hidden="true">
      <defs>
        <linearGradient id="l1WoodW" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#edd5a8" />
          <stop offset="50%" stopColor="#c4956a" />
          <stop offset="100%" stopColor="#8b6914" />
        </linearGradient>
      </defs>
      <path
        d="M10 95 C 30 55, 70 25, 110 20 C 150 15, 175 35, 190 70"
        fill="none"
        stroke="url(#l1WoodW)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[18, 38, 58, 78, 98, 118, 138, 158].map((x, i) => (
        <ellipse
          key={x}
          cx={x + i * 4}
          cy={78 - i * 7}
          rx={13 - i * 0.4}
          ry={7}
          transform={`rotate(${-40 + i * 8} ${x + i * 4} ${78 - i * 7})`}
          fill="url(#l1WoodW)"
          opacity={0.95 - i * 0.03}
        />
      ))}
    </svg>
  )
}

function RestaurantSketch({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 400 320" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="280" cy="200" rx="48" ry="22" opacity="0.55" />
        <ellipse cx="280" cy="196" rx="32" ry="14" opacity="0.4" />
        <path d="M248 200 v28 M312 200 v28" opacity="0.45" />
        <ellipse cx="340" cy="230" rx="36" ry="18" opacity="0.5" />
        <path d="M200 120 h160 M200 140 h140 M200 160 h120" opacity="0.35" />
        <circle cx="260" cy="88" r="14" opacity="0.45" />
        <path d="M260 74 v-18 M252 62 h16" opacity="0.4" />
        <circle cx="320" cy="95" r="11" opacity="0.4" />
        <path d="M320 84 v-14 M314 74 h12" opacity="0.35" />
        <rect x="220" y="100" width="28" height="20" rx="2" opacity="0.35" />
        <rect x="350" y="108" width="24" height="18" rx="2" opacity="0.3" />
        <path d="M230 248 c20-8 40-8 60 0 M250 268 c15-6 30-6 45 0" opacity="0.35" />
      </g>
    </svg>
  )
}

function Level1ProfileBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.parchment} />
      <div className={styles.warmGlow} />
      <RestaurantSketch className={styles.sketchHero} />
      <RestaurantSketch className={styles.sketchBody} />
      <div className={styles.ginghamHero} />
      <div className={styles.ginghamBody} />
      <LeafBranch className={styles.leavesTopLeft} />
      <LeafBranch className={styles.leavesMidLeft} />
      <LeafWreath className={styles.wreathBottomRight} />
      <div className={styles.heroZone}>
        <div className={styles.woodInlay} />
      </div>
      <div className={styles.splitLine} />
      <div className={styles.bodyZone}>
        <div className={styles.floorTiles} />
        <div className={styles.floorSheen} />
      </div>
      <div className={styles.woodFrame} />
      <div className={styles.cornerOrnamentTL} />
      <div className={styles.cornerOrnamentBR} />
    </div>
  )
}

export default Level1ProfileBackdrop
