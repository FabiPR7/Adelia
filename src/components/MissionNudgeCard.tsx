import { Link } from 'react-router-dom'
import MissionIcon from './MissionIcon'
import { useMissionNudge } from '../hooks/useMissionNudge'
import { missionAction, remainingLabel } from '../utils/missionNudges'
import styles from './MissionNudgeCard.module.css'

const RING_RADIUS = 26
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/**
 * "Casi lo tienes": la misión más cercana con su avance, cuánto da y un botón a
 * la acción que la completa, más el cofre semanal. Se muestra en Buscar y en
 * Reservas para que las misiones no sean solo una pestaña a la que hay que ir.
 */
function MissionNudgeCard({ upcomingReservations = 0 }: { upcomingReservations?: number }) {
  const nudge = useMissionNudge()
  const { closest, bonus } = nudge

  if (nudge.loading) {
    return null
  }

  if (!closest) {
    return bonus.earned ? (
      <section className={`${styles.card} ${styles.cardDone}`} aria-label="Misiones de la semana">
        <p className={styles.kicker}>Semana completa</p>
        <p className={styles.doneText}>
          Has conseguido el bonus de la semana (+{bonus.xp} XP). Las misiones nuevas llegan el lunes.
        </p>
      </section>
    ) : null
  }

  const action = missionAction(closest.mission)
  const percent = Math.round(closest.progress * 100)
  const almost = closest.progress >= 0.5
  const fedByReservation = upcomingReservations > 0
    ? nudge.reservationFed.find((item) => item.mission.id === closest.mission.id) ?? nudge.reservationFed[0]
    : undefined

  return (
    <section className={`${styles.card} ${almost ? styles.cardHot : ''}`} aria-label="Tu misión más cercana">
      <div className={styles.main}>
        <div
          className={styles.ring}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Progreso de ${closest.mission.name}`}
        >
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <circle className={styles.ringTrack} cx="30" cy="30" r={RING_RADIUS} />
            <circle
              className={styles.ringValue}
              cx="30"
              cy="30"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - closest.progress)}
            />
          </svg>
          <span className={styles.ringIcon}>
            <MissionIcon mission={closest.mission} size="md" />
          </span>
        </div>

        <div className={styles.body}>
          <p className={styles.kicker}>{almost ? 'Casi lo tienes' : 'Tu próxima misión'}</p>
          <h3 className={styles.title}>{closest.mission.name}</h3>
          <p className={styles.meta}>
            {remainingLabel(closest)} · <strong>+{closest.mission.xp} XP</strong>
          </p>
        </div>

        <Link to={action.to} className={styles.cta}>
          {action.label}
        </Link>
      </div>

      {fedByReservation ? (
        <p className={styles.hint}>
          Tu próxima reserva suma a «{fedByReservation.mission.name}» cuando asistas.
        </p>
      ) : null}

      <div className={styles.chest} aria-label={`Bonus semanal: ${bonus.done} de ${bonus.target} misiones`}>
        <div className={styles.pips} aria-hidden="true">
          {Array.from({ length: bonus.target }, (_, index) => (
            <span key={index} className={`${styles.pip} ${index < bonus.done ? styles.pipOn : ''}`} />
          ))}
        </div>
        <p className={styles.chestText}>
          {bonus.earned
            ? `Bonus semanal conseguido (+${bonus.xp} XP)`
            : `${bonus.done}/${bonus.target} semanales · ${bonus.left === 1 ? 'una más' : `${bonus.left} más`} para +${bonus.xp} XP`}
          <span className={styles.timeLeft}> · {nudge.timeLeft}</span>
        </p>
        <Link to="/app/misiones" className={styles.all}>
          Ver todas ({nudge.pendingWeekly.length + nudge.pendingMonthly.length})
        </Link>
      </div>
    </section>
  )
}

export default MissionNudgeCard
