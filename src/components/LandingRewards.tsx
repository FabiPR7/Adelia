import { BurgerArt, CocktailArt, FriesArt } from './LandingPromoArt'
import styles from './LandingRewards.module.css'

/**
 * Promociones de ejemplo para explicar cómo funcionan. No son ofertas reales:
 * van marcadas como ejemplo y no enlazan a ninguna reserva.
 */
const EXAMPLE_PROMOS = [
  {
    Art: FriesArt,
    tone: styles.toneCream,
    badge: '15 €',
    type: 'Gasto mínimo',
    title: 'Por 15 € de consumo, llévate unas patatas',
    condition: 'Al pedir en el local',
  },
  {
    Art: BurgerArt,
    tone: styles.toneAccent,
    badge: 'GRATIS',
    type: 'Por reservas',
    title: 'A la 3.ª reserva, hamburguesa gratis',
    condition: 'Se desbloquea con 3 reservas',
  },
  {
    Art: CocktailArt,
    tone: styles.toneDark,
    badge: '-50%',
    type: 'Tiempo limitado',
    title: '50 % de descuento en cócteles',
    condition: 'De 17:00 a 19:00',
  },
]

const STEPS = [
  { title: 'Reserva con Adelia', text: 'Elige restaurante, día y hora.' },
  { title: 'Ve y consume', text: 'Cada visita suma en ese restaurante.' },
  { title: 'Canjea tu premio', text: 'En el local, con el código del restaurante.' },
]

function LandingRewards() {
  return (
    <section className={styles.section} aria-labelledby="landing-rewards-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Premios</p>
        <h2 id="landing-rewards-title">
          Come, vuelve
          <span> y llévate premios</span>
        </h2>
        <p className={styles.lead}>
          Los restaurantes de Adelia premian a quien vuelve: descuentos, productos gratis y ofertas
          que se desbloquean al consumir en su casa.
        </p>
      </header>

      <ul className={styles.examples}>
        {EXAMPLE_PROMOS.map(({ Art, ...promo }) => (
          <li key={promo.title} className={`${styles.example} ${promo.tone}`}>
            <div className={styles.exampleArt} aria-hidden="true">
              <Art />
            </div>
            <span className={styles.exampleTag}>Ejemplo</span>
            <div className={styles.exampleBody}>
              <span className={styles.exampleBadge}>{promo.badge}</span>
              <span className={styles.exampleType}>{promo.type}</span>
              <h3>{promo.title}</h3>
              <p>{promo.condition}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.examplesNote}>
        Promociones de ejemplo: cada restaurante crea las suyas, con sus propias condiciones.
      </p>

      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <span>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default LandingRewards
