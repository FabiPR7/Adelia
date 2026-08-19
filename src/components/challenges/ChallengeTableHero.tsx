import { AdeliaMark } from './challengeBrand'
import styles from './ChallengeTableHero.module.css'

interface ChallengeTableHeroProps {
  title: string
  lead?: string
  venue?: string
}

export function ChallengeTableHero({ title, lead, venue }: ChallengeTableHeroProps) {
  return (
    <header className={styles.hero}>
      <span className={styles.glow} aria-hidden />
      <span className={styles.shine} aria-hidden />
      <span className={`${styles.dot} ${styles.dotA}`} aria-hidden />
      <span className={`${styles.dot} ${styles.dotB}`} aria-hidden />
      <span className={`${styles.spark} ${styles.sparkTl}`} aria-hidden />
      <span className={`${styles.spark} ${styles.sparkTr}`} aria-hidden />
      <span className={`${styles.spark} ${styles.sparkBl}`} aria-hidden />
      <span className={`${styles.spark} ${styles.sparkBr}`} aria-hidden />

      <div className={styles.mark}>
        <span className={styles.markRing} aria-hidden />
        <span className={styles.markInner}>
          <AdeliaMark className={styles.logo} />
        </span>
      </div>

      <div className={styles.copy}>
        <p className={styles.kicker}>Adelia</p>
        <h1 className={styles.title}>{title}</h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </div>

      {venue ? <p className={styles.venue}>{venue}</p> : null}
    </header>
  )
}
