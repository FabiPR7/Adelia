import { Crown, Dices, Flame, Grid3x3, Layers, Swords, Timer, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CHALLENGE_MINIGAME_IDS, CHALLENGE_MINIGAME_LABELS } from '../types/reservationChallenges'
import { getLevelForXp } from '../utils/gamificationProgress'
import { getStripEmblem } from '../utils/levelRankingStripAssets'
import styles from './LandingFriends.module.css'

const GAME_ICONS = {
  three_cards: Layers,
  odds_evens: Dices,
  stopwatch: Timer,
  maze: Grid3x3,
  hot_cold: Flame,
} as const

/** Ilustración: personas de ejemplo, no datos de usuarios reales. */
const EXAMPLE_FRIENDS = [
  { name: 'Lucía', xp: 2450, color: '#c2553a' },
  { name: 'Tú', xp: 1980, color: '#e3825f', isYou: true },
  { name: 'Dani', xp: 1320, color: '#8a6a55' },
  { name: 'Marta', xp: 860, color: '#5d7466' },
]

const FEATURES = [
  {
    icon: Users,
    title: 'Ranking entre amigos',
    text: 'Añade a tu gente y mira en qué puesto quedas.',
  },
  {
    icon: Swords,
    title: 'Duelos en la mesa',
    text: 'Cuando reserváis juntos, un minijuego decide quién gana.',
  },
  {
    icon: Trophy,
    title: 'Niveles y escudos',
    text: 'Cada reserva y cada reseña suman XP para subir de nivel.',
  },
]

interface LandingFriendsProps {
  isCustomer: boolean
}

function LandingFriends({ isCustomer }: LandingFriendsProps) {
  const maxXp = EXAMPLE_FRIENDS[0].xp

  return (
    <section className={styles.section} aria-labelledby="landing-friends-title">
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Compite con tus amigos</p>
          <h2 id="landing-friends-title">¿Quién es el mejor de Adelia?</h2>
          <p className={styles.lead}>
            Sumad XP reservando y opinando, retaos en la mesa y que gane quien más sabe de comer.
          </p>

          <ul className={styles.features}>
            {FEATURES.map((feature) => {
              const Icon = feature.icon

              return (
                <li key={feature.title}>
                  <span className={styles.featureIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{feature.title}</strong>
                    <span>{feature.text}</span>
                  </span>
                </li>
              )
            })}
          </ul>

          <div className={styles.actions}>
            <Link
              to={isCustomer ? '/app/misiones' : '/cuenta/registro'}
              className={styles.cta}
            >
              {isCustomer ? 'Ver mi ranking' : 'Crear cuenta y retar a mis amigos'}
            </Link>
            {!isCustomer ? <span className={styles.ctaNote}>Gratis y sin tarjeta</span> : null}
          </div>
        </div>

        <div className={styles.showcase} aria-hidden="true">
          <div className={styles.board}>
            <div className={styles.boardHeader}>
              <span>Ranking de amigos</span>
              <span className={styles.exampleTag}>Ejemplo</span>
            </div>
            <ol>
              {EXAMPLE_FRIENDS.map((friend, index) => {
                const level = getLevelForXp(friend.xp)

                return (
                  <li key={friend.name} className={friend.isYou ? styles.rowYou : undefined}>
                    <span className={styles.rank}>
                      {index === 0 ? <Crown size={18} /> : index + 1}
                    </span>
                    <span className={styles.avatar} style={{ background: friend.color }}>
                      {friend.name.charAt(0)}
                    </span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowTop}>
                        <strong>{friend.name}</strong>
                        <span className={styles.xp}>{friend.xp.toLocaleString('es-ES')} XP</span>
                      </span>
                      <span className={styles.bar}>
                        <span style={{ width: `${Math.round((friend.xp / maxXp) * 100)}%` }} />
                      </span>
                    </span>
                    <img src={getStripEmblem(level.level)} alt="" className={styles.shield} loading="lazy" />
                  </li>
                )
              })}
            </ol>
          </div>

          <div className={styles.duel}>
            <div className={styles.duelPlayers}>
              <span className={styles.avatar} style={{ background: '#e3825f' }}>T</span>
              <span className={styles.vs}>VS</span>
              <span className={styles.avatar} style={{ background: '#c2553a' }}>L</span>
            </div>
            <ul className={styles.games}>
              {CHALLENGE_MINIGAME_IDS.map((id) => {
                const Icon = GAME_ICONS[id]

                return (
                  <li key={id}>
                    <Icon size={15} />
                    {CHALLENGE_MINIGAME_LABELS[id]}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      <p className={styles.note}>XP, niveles y premios del juego son virtuales: no se compran ni se canjean por dinero.</p>
    </section>
  )
}

export default LandingFriends
