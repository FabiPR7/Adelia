/** Ilustraciones propias (SVG) para las promociones de ejemplo de la landing. */

const FRY_HEIGHTS = [52, 40, 60, 34, 48, 30, 56, 44]

export function FriesArt() {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Cucurucho de patatas fritas">
      <circle cx="160" cy="120" r="96" fill="#fffaf3" />
      <ellipse cx="160" cy="214" rx="74" ry="10" fill="rgba(74, 42, 32, 0.16)" />
      {FRY_HEIGHTS.map((top, index) => (
        <rect
          key={index}
          x={110 + index * 13}
          y={top + 10}
          width="13"
          height={150 - top}
          rx="4"
          fill={index % 2 === 0 ? '#f6c453' : '#f3b43c'}
          stroke="#d9962a"
          strokeWidth="1.5"
          transform={`rotate(${(index - 3.5) * 2.5} ${116 + index * 13} 150)`}
        />
      ))}
      <path d="M98 112 L222 112 L206 208 L114 208 Z" fill="#c2553a" />
      <path d="M94 106 Q160 128 226 106 L222 120 Q160 142 98 120 Z" fill="#a8432f" />
      <path d="M106 150 L214 150 L211 170 L109 170 Z" fill="#fff7f0" />
      <circle cx="160" cy="160" r="13" fill="#c2553a" />
      <path d="M154 160 L158 164 L166 155" fill="none" stroke="#fff7f0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SESAME = [
  [130, 84, -20],
  [152, 74, 10],
  [176, 80, -10],
  [196, 92, 25],
  [118, 102, 15],
  [164, 96, -30],
  [140, 104, 30],
  [204, 112, -15],
]

export function BurgerArt() {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Hamburguesa">
      <circle cx="160" cy="125" r="96" fill="rgba(255, 247, 240, 0.14)" />
      <ellipse cx="160" cy="212" rx="84" ry="10" fill="rgba(31, 23, 20, 0.25)" />
      <path d="M88 176 Q88 202 116 202 L204 202 Q232 202 232 176 Z" fill="#d9893b" />
      <rect x="84" y="150" width="152" height="28" rx="14" fill="#5a3324" />
      <path d="M82 145 L238 145 L238 152 L212 152 L201 168 L190 152 L132 152 L119 170 L107 152 L82 152 Z" fill="#f6c453" />
      <rect x="90" y="132" width="140" height="15" rx="7.5" fill="#d94a3a" />
      <path
        d="M78 134 q10 -11 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L242 141 L78 141 Z"
        fill="#7bb661"
      />
      <path d="M82 130 Q82 58 160 58 Q238 58 238 130 Z" fill="#e9a24a" />
      <path d="M100 112 Q104 76 150 68" fill="none" stroke="#f5c27a" strokeWidth="8" strokeLinecap="round" />
      {SESAME.map(([cx, cy, angle], index) => (
        <ellipse
          key={index}
          cx={cx}
          cy={cy}
          rx="5"
          ry="2.6"
          fill="#fff3d6"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
    </svg>
  )
}

export function CocktailArt() {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Cóctel y reloj de hora feliz">
      <defs>
        <linearGradient id="landing-cocktail-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6a15a" />
          <stop offset="1" stopColor="#c2553a" />
        </linearGradient>
      </defs>
      <circle cx="160" cy="122" r="96" fill="rgba(227, 130, 95, 0.12)" />
      <ellipse cx="166" cy="212" rx="60" ry="9" fill="rgba(0, 0, 0, 0.3)" />

      <circle cx="78" cy="66" r="28" fill="#fff7f0" />
      <circle cx="78" cy="66" r="28" fill="none" stroke="#e3825f" strokeWidth="4" />
      <path d="M78 66 L78 50 M78 66 L90 72" stroke="#1f1714" strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="66" r="3" fill="#1f1714" />

      <line x1="146" y1="34" x2="158" y2="118" stroke="#fff7f0" strokeWidth="6" strokeLinecap="round" />
      <path d="M104 72 L228 72 Q222 146 166 150 Q110 146 104 72 Z" fill="rgba(255, 247, 240, 0.18)" stroke="#fff7f0" strokeWidth="3" />
      <path d="M110 90 L222 90 Q214 140 166 144 Q118 140 110 90 Z" fill="url(#landing-cocktail-liquid)" />
      <circle cx="146" cy="112" r="4" fill="rgba(255, 247, 240, 0.7)" />
      <circle cx="176" cy="124" r="3" fill="rgba(255, 247, 240, 0.6)" />
      <circle cx="194" cy="104" r="3.5" fill="rgba(255, 247, 240, 0.6)" />
      <rect x="162" y="150" width="8" height="50" rx="3" fill="#fff7f0" />
      <ellipse cx="166" cy="202" rx="40" ry="7" fill="#fff7f0" />

      <circle cx="222" cy="74" r="25" fill="#f6d258" stroke="#fff7f0" strokeWidth="4" />
      <path
        d="M222 74 L222 52 M222 74 L241 63 M222 74 L241 85 M222 74 L222 96 M222 74 L203 85 M222 74 L203 63"
        stroke="#fff3c4"
        strokeWidth="2.5"
      />
    </svg>
  )
}
