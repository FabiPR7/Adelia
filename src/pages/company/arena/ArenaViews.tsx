import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Trophy } from 'lucide-react'
import MissionIcon from '../../../components/MissionIcon'
import { COMPANY_LEVELS, COMPANY_WEEKLY_BONUS_TARGET, getCompanyLevelForXp } from '../../../data/companyGamificationCatalog'
import type { useCompanyGamification } from '../../../hooks/useCompanyGamification'
import { fetchCompanyLeague, type CompanyLeagueView, type LeagueId } from '../../../services/companyGamification'
import type { MissionProgress } from '../../../types/gamification'
import {
  LEAGUE_SHORT,
  TIERS,
  initials,
  monthLabel,
  monthName,
  placeTone,
  prestigeTone,
  shiftMonth,
} from './arenaUtils'
import styles from './Arena.module.css'
import { formatNumber } from '../../../utils/formatNumber'

type Gamification = ReturnType<typeof useCompanyGamification>

const PRIZES = [
  { place: '1', tone: 'gold', text: 'Trofeo de oro en tu ficha, primero en «Lo mejor del mes» y +500 XP.' },
  { place: '2', tone: 'silver', text: 'Trofeo de plata, podio en la app y +300 XP.' },
  { place: '3', tone: 'bronze', text: 'Trofeo de bronce, podio en la app y +200 XP.' },
  { place: '10', tone: 'plain', text: 'Top 10: más arriba en las búsquedas de tu ciudad y +50 XP.' },
] as const

/* ---------- Clasificaciones ---------- */

export function ArenaStandings({ initial, league }: { initial: CompanyLeagueView; league: LeagueId | null }) {
  const [month, setMonth] = useState(initial.month)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState<'city' | 'spain'>(initial.city ? 'city' : 'spain')
  const [leagueId, setLeagueId] = useState<LeagueId>(league ?? 'reservations')

  useEffect(() => {
    if (month === data.month) return
    let cancelled = false
    setLoading(true)
    fetchCompanyLeague(month)
      .then((view) => {
        if (!cancelled) setData(view)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, data.month])

  const boards = useMemo(
    () => (scope === 'city' ? data.city?.boards : data.spain.boards) ?? [],
    [data, scope],
  )
  const board = boards.find((item) => item.id === leagueId) ?? boards[0] ?? null
  const monthOptions = Array.from({ length: 6 }, (_, index) => shiftMonth(initial.currentMonth, -index))
  const scopeName = scope === 'city' ? data.city?.name || 'tu ciudad' : 'España'
  const isCurrent = data.month === data.currentMonth

  return (
    <>
      <div className={styles.toolbar}>
        {data.city ? (
          <div className={styles.seg} role="group" aria-label="Zona">
            <button type="button" aria-pressed={scope === 'city'} className={scope === 'city' ? styles.segBtnOn : styles.segBtn} onClick={() => setScope('city')}>
              {data.city.name || 'Mi ciudad'}
            </button>
            <button type="button" aria-pressed={scope === 'spain'} className={scope === 'spain' ? styles.segBtnOn : styles.segBtn} onClick={() => setScope('spain')}>
              España
            </button>
          </div>
        ) : null}
        <div className={styles.seg} role="group" aria-label="Liga">
          {(['reservations', 'promotions', 'rating', 'rising'] as LeagueId[]).map((id) => (
            <button key={id} type="button" aria-pressed={leagueId === id} className={leagueId === id ? styles.segBtnOn : styles.segBtn} onClick={() => setLeagueId(id)}>
              {LEAGUE_SHORT[id]}
            </button>
          ))}
        </div>
        <select className={styles.select} value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mes">
          {monthOptions.map((option) => (
            <option key={option} value={option}>
              {monthLabel(option)}{option === initial.currentMonth ? ' (en curso)' : ''}
            </option>
          ))}
        </select>
        {loading ? <span className={styles.muted}>Cargando…</span> : null}
      </div>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>{scopeName} · {isCurrent ? 'en juego' : 'mes cerrado'}</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{board?.name ?? 'Liga'}</h2>
              <span className={styles.small}>{board?.rule}</span>
            </div>
            <span className={styles.muted}>{board?.total ?? 0} {board?.total === 1 ? 'restaurante' : 'restaurantes'}</span>
          </div>
          {!board || board.top.length === 0 ? (
            <p className={styles.empty}>Todavía nadie puntúa en esta liga. ¡El primero en moverse se lleva el podio!</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Puesto</th>
                    <th scope="col">Restaurante</th>
                    <th scope="col">Nivel</th>
                    <th scope="col" className={styles.right}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {board.top.map((row) => (
                    <tr key={row.companyId} className={row.isMe ? styles.rowMe : ''}>
                      <td><span className={`${styles.place} ${styles[`place_${placeTone(row.rank)}`] ?? ''}`}>{row.rank}</span></td>
                      <td>
                        <span className={styles.restName}>{row.name}{row.isMe ? ' (tú)' : ''}</span>
                        <span className={styles.restMeta}>{row.municipality}</span>
                      </td>
                      <td>
                        <span className={`${styles.tierPill} ${styles[`tierPill_${prestigeTone(row.level)}`]}`}>Nv. {row.level}</span>
                      </td>
                      <td className={`${styles.right} ${styles.result}`}>{row.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {board?.me && board.me.rank > 10 ? (
            <p className={styles.small}>Tú vas <strong>{board.me.rank}.º</strong> con {board.me.display}.</p>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.card}>
            <span className={styles.kicker}>Lo que se gana cada mes</span>
            <ul className={styles.prizeList}>
              {PRIZES.map((prize) => (
                <li key={prize.place}>
                  <span className={`${styles.medal} ${styles[`medal_${prize.tone}`]}`}>{prize.place}</span>
                  <span>{prize.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.card}>
            <span className={styles.kicker}><ShieldCheck size={13} aria-hidden="true" /> Juego limpio</span>
            <p className={styles.small}>
              Cuentan las reservas que marcas como «Asistió». De un mismo cliente cuentan como mucho 4 al mes, y en empate
              gana quien tenga menos faltas. «Mejor valorado» necesita 5 reseñas del mes y «Revelación», 5 asistencias.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------- Retos ---------- */

type ChallengeTab = 'weekly' | 'monthly' | 'done' | 'achievements'

function MissionRows({ items, empty }: { items: MissionProgress[]; empty: string }) {
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>
  return (
    <ul className={styles.missionList}>
      {items.map((item) => (
        <li key={`${item.mission.cadence}-${item.mission.id}`} className={`${styles.mission} ${item.completed ? styles.missionDone : ''}`}>
          <span className={styles.missionIcon}><MissionIcon mission={item.mission} size="sm" /></span>
          <div className={styles.missionBody}>
            <div className={styles.missionHead}>
              <strong>{item.mission.name}</strong>
              <span>{item.completed ? 'Hecho' : `${item.current} / ${item.mission.target}`}</span>
            </div>
            <p className={styles.missionDesc}>{item.mission.description}</p>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${Math.round(item.progress * 100)}%` }} />
            </div>
          </div>
          <span className={styles.missionXp}>+{item.mission.xp} XP</span>
        </li>
      ))}
    </ul>
  )
}

export function ArenaChallenges({ gamification }: { gamification: Gamification }) {
  const [tab, setTab] = useState<ChallengeTab>('weekly')
  const chest = gamification.weeklyBonus
  const done = [...gamification.weeklyProgress, ...gamification.monthlyProgress].filter((item) => item.completed)
  const achievementsDone = gamification.historicalProgress.filter((item) => item.completed).length
  const tabs: Array<[ChallengeTab, string]> = [
    ['weekly', `Semana · ${gamification.weeklyProgress.filter((item) => item.completed).length}/${gamification.weeklyProgress.length}`],
    ['monthly', `Mes · ${gamification.monthlyProgress.filter((item) => item.completed).length}/${gamification.monthlyProgress.length}`],
    ['done', 'Completados'],
    ['achievements', `Logros · ${achievementsDone}/${gamification.historicalProgress.length}`],
  ]

  return (
    <>
      <div className={`${styles.chest} ${chest.bonusEarned ? styles.chestOpen : ''}`}>
        <span>
          {chest.bonusEarned ? (
            <><strong>¡Cofre semanal abierto!</strong> El lunes empieza otro.</>
          ) : (
            <>Completa <strong>{COMPANY_WEEKLY_BONUS_TARGET} retos de la semana</strong> y abre el cofre. Se renueva cada lunes.</>
          )}
        </span>
        <span className={styles.chestDots} aria-label={`${chest.completedCount} de ${COMPANY_WEEKLY_BONUS_TARGET}`}>
          {Array.from({ length: COMPANY_WEEKLY_BONUS_TARGET }, (_, index) => (
            <span key={index} className={`${styles.chestDot} ${index < chest.completedCount ? styles.chestDotOn : ''}`} />
          ))}
        </span>
        <span className={styles.chestXp}>+{chest.bonusXp} XP</span>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.kicker}>Tus retos</span>
          <div className={styles.seg} role="tablist" aria-label="Tipo de retos">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? styles.segBtnOn : styles.segBtn} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {tab === 'weekly' ? <MissionRows items={gamification.weeklyProgress} empty="No hay retos esta semana." /> : null}
        {tab === 'monthly' ? <MissionRows items={gamification.monthlyProgress} empty="No hay retos este mes." /> : null}
        {tab === 'done' ? <MissionRows items={done} empty="Aún no has completado retos de este periodo." /> : null}
        {tab === 'achievements' ? <MissionRows items={gamification.historicalProgress} empty="Todavía no hay logros." /> : null}
      </div>
    </>
  )
}

/* ---------- Vitrina ---------- */

export function ArenaShowcase({ data }: { data: CompanyLeagueView }) {
  const level = getCompanyLevelForXp(data.level.xp)
  const badges = data.badges ?? []
  const earned = badges.filter((badge) => badge.tier).length
  const tierName = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' } as const

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.kicker}><Trophy size={13} aria-hidden="true" /> Trofeos de la Liga</span>
          <span className={styles.muted}>Tus clientes los ven en tu ficha al reservar</span>
        </div>
        {data.trophies.length === 0 ? (
          <p className={styles.empty}>Aún no tienes trofeos. Entra en el podio de tu ciudad y el día 1 tendrás el primero.</p>
        ) : (
          <div className={styles.medalGrid}>
            {data.trophies.map((trophy) => (
              <div key={`${trophy.month}-${trophy.league}-${trophy.scope}`} className={styles.medalCard}>
                <span className={`${styles.medal} ${styles[`medal_${placeTone(trophy.rank)}`]}`}>{trophy.rank}</span>
                <span className={styles.medalLabel}>{LEAGUE_SHORT[trophy.league]}</span>
                <span className={styles.medalWhen}>
                  {monthName(trophy.month)} · {trophy.scope === 'spain' ? 'España' : data.city?.name || 'Ciudad'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.kicker}>Insignias</span>
          <span className={styles.muted}>{earned} de {badges.length} conseguidas · bronce, plata y oro</span>
        </div>
        <div className={styles.badgeGrid}>
          {badges.map((badge) => {
            const target = badge.next ?? badge.thresholds[2]
            const pct = Math.min(100, Math.round((badge.value / Math.max(1, target)) * 100))
            const nextName = badge.tier === 'silver' ? 'oro' : badge.tier === 'bronze' ? 'plata' : 'bronce'
            return (
              <div key={badge.id} className={`${styles.badge} ${badge.tier ? '' : styles.badgeLocked}`}>
                <div className={styles.badgeHead}>
                  <span className={`${styles.medal} ${styles[`medal_${badge.tier ?? 'plain'}`]}`}>{initials(badge.name)}</span>
                  <div>
                    <strong>{badge.name}</strong>
                    <span>{badge.tier ? tierName[badge.tier] : 'Sin conseguir'}</span>
                  </div>
                </div>
                <span className={styles.badgeDesc}>{badge.description}</span>
                <div className={styles.track} aria-hidden="true">
                  <div className={styles.fill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.badgeProgress}>
                  {badge.next == null
                    ? 'Oro conseguido'
                    : `${formatNumber(badge.value)} / ${formatNumber(badge.next)} para ${nextName}`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.kicker}>Niveles de prestigio</span>
          <span className={styles.muted}>Tu nivel se ve en tu ficha y en Explorar</span>
        </div>
        <div className={styles.tiers}>
          {TIERS.map((tier) => {
            const levels = tier.levels as readonly number[]
            return (
              <div key={tier.id} className={`${styles.tier} ${levels.includes(level.level) ? styles.tierOn : ''}`}>
                <span className={`${styles.tierPill} ${styles[`tierPill_${tier.id}`]}`}>{tier.label}</span>
                <ul className={styles.tierLevels}>
                  {COMPANY_LEVELS.filter((item) => levels.includes(item.level)).map((item) => (
                    <li
                      key={item.level}
                      className={item.level === level.level ? styles.tierLevelOn : item.level < level.level ? styles.tierLevelDone : ''}
                    >
                      <b>{item.level}</b>
                      <span>{item.title}</span>
                      <span>{formatNumber(item.minXp)}</span>
                    </li>
                  ))}
                </ul>
                <ul className={styles.tierPerks}>
                  {tier.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}
                </ul>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
