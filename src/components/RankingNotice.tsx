import { Link } from 'react-router-dom'
import styles from './RankingNotice.module.css'

/** Art. 26.2 de la Ley de Competencia Desleal: el orden influido por un pago debe indicarse. */
function RankingNotice() {
  return (
    <p className={styles.notice}>
      Incluye locales destacados de pago. <Link to="/legal/terminos">Cómo ordenamos</Link>
    </p>
  )
}

export default RankingNotice
