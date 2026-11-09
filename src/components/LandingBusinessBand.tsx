import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './LandingBusinessBand.module.css'

function LandingBusinessBand() {
  return (
    <section className={styles.band} aria-labelledby="landing-business-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Para restaurantes</p>
        <h2 id="landing-business-title">¿Tienes un restaurante?</h2>
        <p>
          Gestiona reservas, mesas y promociones desde un solo panel, y consigue clientes que
          vuelven.
        </p>
      </div>
      <Link to="/empresa" className={styles.cta}>
        Conocer Adelia para restaurantes
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  )
}

export default LandingBusinessBand
