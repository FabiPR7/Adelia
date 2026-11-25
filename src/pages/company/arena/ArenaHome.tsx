import { useEffect, useState } from 'react'
import { Flame, Star } from 'lucide-react'
import MissionIcon from '../../../components/MissionIcon'
import type { CompanyLeagueView, LeagueBoardView, LeagueId } from '../../../services/companyGamification'
import type { CompanyNotification } from '../../../types/companyNotifications'
import type { CompanyTab } from '../../../types/company'
import { COMPANY_WEEKLY_BONUS_TARGET, getCompanyLevelForXp } from '../../../data/companyGamificationCatalog'
import type { useCompanyGamification } from '../../../hooks/useCompanyGamification'
import {
  LEAGUE_SHORT,
  TIERS,
  bestBoard,
  formatGap,
  initials,
  monthName,
  placeTone,
  podiumStreak,
  prestigeTone,
  timeLeftInMonth,
  trend,
  type ArenaView,
} from './arenaUtils'
import styles from './Arena.module.css'
import { formatNumber } from '../../../utils/formatNumber'

type Gamification = ReturnType<typeof useCompanyGamification>

interface ArenaHomeProps {
  data: CompanyLeagueView
  gamification: Gamification
  notifications: CompanyNotification[]
  onView: (view: ArenaView, league?: LeagueId) => void
  onOpenTab: (tab: CompanyTab) => void
}

const RING = 2 * Math.PI * 56

function useCountdown() {
  const [left, setLeft] = useState(() => timeLeftInMonth())
  useEffect(() => {
    const id = window.setInterval(() => setLeft(timeLeftInMonth()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return left
}

function relative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 60) return minutes < 1 ? 'Ahora' : `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Ayer' : `Hace ${days} días`
}

function heroMessage(board: LeagueBoardView | null, rivalsTotal: number) {
  if (!board?.me) {
    return (
      <>
        Aún no puntúas este mes. Marca la <span className={styles.heroHighlight}>asistencia</span> de tus reservas y entrega
        premios con PIN para entrar en la liga.
      </>
    )
  }
  if (board.ahead) {
    const place = board.ahead.rank === 1 ? 'el 1.º' : `el ${board.ahead.rank}.º puesto`
    return (
      <>
        Te faltan <span className={styles.heroHighlight}>{formatGap(board, board.ahead.gap)}</span> para quitarle {place} a{' '}
        {board.ahead.name}
        {board.ahead.rank === 1 ? ' y llevarte el trofeo de oro.' : '.'}
      </>
    )
  }
  if (board.behind) {
    return (
      <>
        Vas líder. {board.behind.name} te persigue a{' '}
        <span className={styles.heroHighlight}>{formatGap(board, board.behind.gap)}</span>: no aflojes hasta fin de mes.
      </>
    )
  }
  return rivalsTotal <= 1 ? (
    <>Vas líder y aún no tienes rivales en tu ciudad. Sigue sumando: cuando lleguen, ya les sacas ventaja.</>
  ) : (
    <>Vas líder. Mantén el ritmo hasta el cierre para llevarte el trofeo de oro.</>
  )
}

export default function ArenaHome({ data, gamification, notifications, onView, onOpenTab }: ArenaHomeProps) {
  const left = useCountdown()
  const boards = data.city?.boards ?? data.spain.boards ?? []
  const scopeName = data.city?.name || 'España'
  const star = bestBoard(boards)
  const starTrend = star ? trend(star) : null
  const rival = star?.ahead ?? star?.behind ?? null
  const level = getCompanyLevelForXp(data.level.xp)
  const toNext = gamification.xpToNext
  const progress = gamification.levelProgress
  const tone = prestigeTone(level.level)
  const nextTier = TIERS.find((tier) => (tier.levels as readonly number[])[0] > level.level)
  const streak = podiumStreak(data)
  const weekly = [...gamification.weeklyProgress].sort((a, b) => Number(a.completed) - Number(b.completed)).slice(0, 4)
  const chest = gamification.weeklyBonus

  const myScore = star?.me?.score ?? 0
  const rivalScore = rival?.score ?? 0
  const myShare = myScore + rivalScore > 0 ? Math.round((myScore / (myScore + rivalScore)) * 100) : 50

  const podium = star ? [2, 1, 3].map((rank) => star.top.find((row) => row.rank === rank) ?? null) : []

  const feed: Array<{ key: string; sign: string; tone: string; text: string; detail?: string; when: string }> = []
  for (const board of boards) {
    if (!board.me) continue
    if (board.ahead && feed.length < 2) {
      feed.push({
        key: `ahead-${board.id}`,
        sign: '!',
        tone: styles.pill_flame,
        text: `Te faltan ${formatGap(board, board.ahead.gap)} para adelantar a ${board.ahead.name} en «${LEAGUE_SHORT[board.id]}»`,
        when: 'Ahora',
      })
    } else if (board.behind && feed.length < 2) {
      feed.push({
        key: `behind-${board.id}`,
        sign: '▼',
        tone: styles.pill_down,
        text: `${board.behind.name} te persigue en «${LEAGUE_SHORT[board.id]}», a ${formatGap(board, board.behind.gap)}`,
        when: 'Ahora',
      })
    }
  }
  for (const board of boards) {
    const t = trend(board)
    if (t?.dir === 'up' && board.me && feed.length < 3) {
      feed.push({
        key: `up-${board.id}`,
        sign: '▲',
        tone: styles.pill_up,
        text: `Has subido ${t.text.replace('▲ ', '')} ${t.text === '▲ 1' ? 'puesto' : 'puestos'} en «${LEAGUE_SHORT[board.id]}» frente al mes pasado`,
        when: 'Este mes',
      })
    }
  }
  for (const notification of notifications) {
    if (feed.length >= 6) break
    if (!['league_result', 'level_up', 'badge_unlocked', 'mission_completed'].includes(notification.type)) continue
    feed.push({
      key: notification.id,
      sign: notification.type === 'mission_completed' ? '✓' : '★',
      tone: notification.type === 'mission_completed' ? styles.pill_up : styles.pill_gold,
      text: notification.title,
      detail: notification.body,
      when: relative(notification.createdAt),
    })
  }

  return (
    <>
      <section className={styles.grid2}>
        <div className={styles.hero}>
          <Flame size={260} strokeWidth={1.2} className={styles.heroFlame} aria-hidden="true" />
          <div className={styles.heroTop}>
            <div>
              <span className={styles.heroKicker}>
                Tu puesto en «{star ? LEAGUE_SHORT[star.id] : 'Más reservas'}» · {scopeName}
              </span>
              <div className={styles.heroRankRow}>
                <span className={styles.heroRank}>{star?.me ? <>{star.me.rank}<sup className={styles.ordinal}>º</sup></> : '—'}</span>
                {starTrend ? (
                  <span className={`${styles.heroTrend} ${styles[`heroTrend_${starTrend.dir}`]}`}>
                    {starTrend.dir === 'new' ? 'Primera vez' : `${starTrend.text} vs ${monthName(data.currentMonth === data.month ? shiftPrev(data.month) : data.month)}`}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={styles.countdown}>
              <span className={styles.heroKicker}>Cierra en</span>
              <div className={styles.countdownRow} role="timer" aria-label={`Quedan ${left.days} días y ${left.hours} horas`}>
                <div className={styles.countdownCell}><strong>{String(left.days).padStart(2, '0')}</strong><span>DÍAS</span></div>
                <div className={styles.countdownCell}><strong>{String(left.hours).padStart(2, '0')}</strong><span>HORAS</span></div>
                <div className={styles.countdownCell}><strong>{String(left.minutes).padStart(2, '0')}</strong><span>MIN</span></div>
              </div>
            </div>
          </div>
          <p className={styles.heroMessage}>{heroMessage(star, star?.total ?? 0)}</p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.btnDark} onClick={() => onView('standings', star?.id)}>
              Ver la clasificación
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => onOpenTab('clients-promotions')}>
              Crear una promo
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.kicker}>Cara a cara</span>
            {rival ? (
              <span className={`${styles.pill} ${styles.pill_flame}`}>
                {star?.ahead ? `Duelo por el ${star.ahead.rank}.º` : 'Defiendes tu puesto'}
              </span>
            ) : null}
          </div>
          {rival && star?.me ? (
            <>
              <div className={styles.duel}>
                <div className={styles.fighter}>
                  <span className={`${styles.avatar} ${styles.avatar_me}`}>TÚ</span>
                  <strong>Tu restaurante</strong>
                  <span className={`${styles.score} ${styles.scoreMe}`}>{star.me.display}</span>
                  <span className={styles.muted}>{star.me.rank}.º puesto</span>
                </div>
                <span className={styles.vs}>VS</span>
                <div className={styles.fighter}>
                  <span className={`${styles.avatar} ${styles.avatar_gold}`}>{initials(rival.name)}</span>
                  <strong>{rival.name}</strong>
                  <span className={`${styles.score} ${styles.scoreRival}`}>{rival.display ?? rival.score}</span>
                  <span className={styles.muted}>{rival.rank}.º puesto</span>
                </div>
              </div>
              <div className={styles.duelBar} aria-hidden="true">
                <div className={styles.duelBarMe} style={{ width: `${myShare}%` }} />
                <div className={styles.duelBarGap} />
                <div className={styles.duelBarRival} />
              </div>
              <p className={styles.duelText}>
                {star.ahead ? (
                  <>Le alcanzas con <strong>{formatGap(star, star.ahead.gap)}</strong> más en «{LEAGUE_SHORT[star.id]}».</>
                ) : (
                  <>Le sacas <strong>{formatGap(star, rival.gap)}</strong> de ventaja. Que no te alcance.</>
                )}
              </p>
            </>
          ) : (
            <p className={styles.empty}>
              Aún no tienes rival directo. En cuanto otro restaurante de {scopeName} puntúe cerca de ti, lo verás aquí.
            </p>
          )}
        </div>
      </section>

      <section className={styles.leagueGrid} aria-label="Tus ligas">
        {boards.map((board) => {
          const t = trend(board)
          const rank = board.me?.rank ?? 0
          const medal = rank >= 1 && rank <= 3 ? placeTone(rank) : null
          return (
            <button
              key={board.id}
              type="button"
              className={`${styles.leagueCard} ${medal ? styles[`leagueCard_${medal}`] : ''} ${board.id === star?.id ? styles.leagueCardStar : ''}`}
              onClick={() => onView('standings', board.id)}
            >
              <span className={styles.leagueCardHead}>
                <span className={styles.leagueName}>{LEAGUE_SHORT[board.id]}</span>
                {t ? <span className={`${styles.pill} ${styles[`pill_${t.dir}`]}`}>{t.text}</span> : null}
              </span>
              <span className={styles.leagueRank}>{board.me ? <>{board.me.rank}<sup className={styles.ordinal}>º</sup></> : '—'}</span>
              <span className={styles.leagueValue}>
                {board.me ? `${board.me.display}${board.id === 'rating' || board.id === 'rising' ? '' : ` ${board.unit}`}` : 'Sin puntuar aún'}
              </span>
              <span className={styles.leagueGap}>
                {board.ahead
                  ? `A ${formatGap(board, board.ahead.gap)} del ${board.ahead.rank}.º`
                  : board.me
                    ? 'Vas el primero'
                    : `${board.total} ${board.total === 1 ? 'local compite' : 'locales compiten'}`}
              </span>
            </button>
          )
        })}
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.kicker}>Podio de {scopeName} · si acabara hoy</span>
            <button type="button" className={styles.link} onClick={() => onView('standings', star?.id)}>
              Clasificación completa
            </button>
          </div>
          <div className={styles.podium}>
            {podium.map((row, index) => {
              const rank = [2, 1, 3][index]
              return (
                <div key={rank} className={styles.podiumSpot}>
                  {row ? (
                    <>
                      <span className={`${styles.avatar} ${styles.avatarSm} ${row.isMe ? styles.avatar_me : styles[`avatar_${placeTone(rank)}`]}`}>
                        {row.isMe ? 'TÚ' : initials(row.name)}
                      </span>
                      <span className={`${styles.podiumName} ${row.isMe ? styles.podiumNameMe : ''}`}>
                        {row.isMe ? 'Tú' : row.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`${styles.avatar} ${styles.avatarSm} ${styles.avatar_plain}`}>?</span>
                      <span className={`${styles.podiumName} ${styles.muted}`}>Libre</span>
                    </>
                  )}
                  <div className={`${styles.step} ${styles[`step_${rank}`]} ${row ? '' : styles.stepEmpty} ${row?.isMe ? styles.stepMe : ''}`}>
                    <strong>{rank}</strong>
                    <span>{row ? row.display : '¿Tú?'}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={styles.note}>
            <Star size={18} aria-hidden="true" />
            <span>
              El podio gana <strong>trofeo en su ficha</strong>, sale en «Lo mejor del mes» de la app y suma{' '}
              <strong>+500 / +300 / +200 XP</strong>.
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.kicker}>Tu nivel</span>
          <div className={styles.levelRow}>
            <div className={styles.ring}>
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                <circle cx="66" cy="66" r="56" fill="none" stroke="#2f2924" strokeWidth="12" />
                <circle
                  cx="66"
                  cy="66"
                  r="56"
                  fill="none"
                  stroke={tone === 'gold' ? '#f4b740' : tone === 'silver' ? '#c9d2dd' : tone === 'diamond' ? '#7fd8f0' : '#d08a57'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - progress)}
                  transform="rotate(-90 66 66)"
                />
              </svg>
              <div className={styles.ringCenter}>
                <span>NIVEL</span>
                <strong>{level.level}</strong>
              </div>
            </div>
            <div className={styles.levelInfo}>
              <span className={`${styles.tierPill} ${styles[`tierPill_${tone}`]}`}>Prestigio {data.level.prestige.label}</span>
              <span className={styles.levelTitle}>{level.title}</span>
              <span>
                {formatNumber(data.level.xp)} XP
                {toNext != null ? (
                  <> · <strong style={{ color: 'var(--gold)' }}>{formatNumber(toNext)} para el nivel {level.level + 1}</strong></>
                ) : ' · nivel máximo'}
              </span>
              {nextTier ? (
                <span className={styles.small}>
                  En {nextTier.label}: {lowerFirst(nextTier.perks[0])} y {lowerFirst(nextTier.perks[1])}.
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.ladder} aria-label={`Nivel ${level.level} de 10`}>
            {Array.from({ length: 10 }, (_, index) => {
              const n = index + 1
              const done = n <= level.level
              return (
                <div key={n} className={styles.ladderStep}>
                  <span className={`${styles.ladderBar} ${done ? styles[`ladderBar_${prestigeTone(n)}`] : ''} ${n === level.level ? styles.ladderCurrent : ''}`} />
                  <span className={`${styles.ladderNum} ${n === level.level ? styles.ladderNumOn : done ? styles.ladderNumDone : ''}`}>{n}</span>
                </div>
              )
            })}
          </div>
          <div className={styles.ladderLegend}>
            <span className={styles.legend_bronze}>BRONCE</span>
            <span className={styles.legend_silver}>PLATA</span>
            <span className={styles.legend_gold}>ORO</span>
            <span className={styles.legend_diamond}>DIAMANTE</span>
          </div>
        </div>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.kicker}>Retos de la semana</span>
            {streak > 0 ? (
              <span className={`${styles.pill} ${styles.pill_flame}`}>
                <Flame size={14} aria-hidden="true" />
                {streak === 1 ? '1 mes en el podio' : `${streak} meses seguidos en el podio`}
              </span>
            ) : (
              <button type="button" className={styles.link} onClick={() => onView('challenges')}>
                Ver todos
              </button>
            )}
          </div>
          {weekly.length === 0 ? (
            <p className={styles.empty}>Esta semana no hay retos activos.</p>
          ) : (
            <ul className={styles.missionList}>
              {weekly.map((item) => (
                <li key={item.mission.id} className={`${styles.mission} ${item.completed ? styles.missionDone : ''}`}>
                  <span className={styles.missionIcon}><MissionIcon mission={item.mission} size="sm" /></span>
                  <div className={styles.missionBody}>
                    <div className={styles.missionHead}>
                      <strong>{item.mission.name}</strong>
                      <span>{item.completed ? 'Hecho' : `${item.current} / ${item.mission.target}`}</span>
                    </div>
                    <div className={styles.track} aria-hidden="true">
                      <div className={styles.fill} style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </div>
                  </div>
                  <span className={styles.missionXp}>+{item.mission.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
          <div className={`${styles.chest} ${chest.bonusEarned ? styles.chestOpen : ''}`}>
            <span>
              {chest.bonusEarned ? (
                <><strong>¡Cofre abierto!</strong> Ya tienes el bonus de esta semana.</>
              ) : (
                <>Completa <strong>{COMPANY_WEEKLY_BONUS_TARGET} retos</strong> y abre el cofre semanal</>
              )}
            </span>
            <span className={styles.chestDots} aria-label={`${chest.completedCount} de ${COMPANY_WEEKLY_BONUS_TARGET}`}>
              {Array.from({ length: COMPANY_WEEKLY_BONUS_TARGET }, (_, index) => (
                <span key={index} className={`${styles.chestDot} ${index < chest.completedCount ? styles.chestDotOn : ''}`} />
              ))}
            </span>
            <span className={styles.chestXp}>+{chest.bonusXp} XP</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.kicker}>Movimientos en la liga</span>
          </div>
          {feed.length === 0 ? (
            <p className={styles.empty}>Cuando subas, bajes o alguien se te acerque, lo verás aquí.</p>
          ) : (
            <ul className={styles.feed}>
              {feed.map((item) => (
                <li key={item.key} className={styles.feedItem}>
                  <span className={`${styles.feedSign} ${item.tone}`}>{item.sign}</span>
                  <span className={styles.feedText}>
                    <span>{item.text}</span>
                    {item.detail ? <small className={styles.feedDetail}>{item.detail}</small> : null}
                    <small>{item.when}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.cardHead}>
            <span className={styles.kicker}>Tu vitrina</span>
            <button type="button" className={styles.link} onClick={() => onView('showcase')}>
              Ver vitrina
            </button>
          </div>
          {data.trophies.length === 0 ? (
            <p className={styles.small}>Aún no tienes trofeos. El día 1 se reparten los del mes que cierra.</p>
          ) : (
            <div className={styles.medalGrid}>
              {data.trophies.filter((trophy) => trophy.scope === 'city').slice(0, 4).map((trophy) => (
                <div key={`${trophy.month}-${trophy.league}`} className={styles.medalCard}>
                  <span className={`${styles.medal} ${styles[`medal_${placeTone(trophy.rank)}`]}`}>{trophy.rank}</span>
                  <span className={styles.medalLabel}>{LEAGUE_SHORT[trophy.league]}</span>
                  <span className={styles.medalWhen}>{monthName(trophy.month)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function shiftPrev(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(year, mon - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
