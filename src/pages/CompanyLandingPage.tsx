import { Link } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import heroImage from '../assets/company-landing-hero.webp'
import growthImage from '../assets/company-landing-growth.webp'
import promoHero from '../assets/promo-hero-dining.webp'
import promoGourmet from '../assets/promo-card-gourmet.webp'
import promoDessert from '../assets/promo-card-dessert.webp'
import gamificationHero from '../assets/gamification-ranking-hero.webp'
import cardCalendar from '../assets/landing-card-calendar.webp'
import cardFloorplan from '../assets/landing-card-floorplan.webp'
import cardCrm from '../assets/landing-card-crm.webp'
import cardReports from '../assets/landing-card-reports.webp'
import cardEmail from '../assets/landing-card-email.webp'
import cardProfile from '../assets/landing-card-profile.webp'
import LegalLinks from '../components/LegalLinks'
import styles from './CompanyLandingPage.module.css'

const STATS = [
  { value: 'Gratis', label: 'para empezar con Mesa' },
  { value: '24/7', label: 'reservas sin llamadas' },
  { value: '1 panel', label: 'mesas, clientes y promos' },
  { value: '0 €', label: 'comisión por reserva*' },
] as const

const PILLARS = [
  {
    icon: '📈',
    title: 'Más ventas, cero mesas muertas',
    copy: 'Turnos vacíos se llenan con promos y visibilidad en la app. Tu sala factura hasta el último servicio.',
    accent: 'coral',
  },
  {
    icon: '👥',
    title: 'Clientes que vuelven solos',
    copy: 'Historial, preferencias y fidelización integrada. Sabes quién repite — sin Excel ni cuadernos.',
    accent: 'wine',
  },
  {
    icon: '✨',
    title: 'Te encuentran antes de pasar',
    copy: 'Descubrimiento, mapa y promos destacadas. Gente nueva te ve antes de cruzar la calle.',
    accent: 'gold',
  },
  {
    icon: '🎯',
    title: 'Promos que llenan mesas',
    copy: 'Franjas horarias, cupos y regalos por reservas. Publicadas donde tus comensales ya miran.',
    accent: 'magenta',
  },
] as const

const PROMO_SHOWCASE = [
  {
    id: 'time',
    layout: 'feature' as const,
    image: promoHero,
    tag: 'Tiempo limitado',
    title: 'Ofertas por franja horaria y cupos',
    copy:
      'Define un tramo — mediodía, cena temprana, domingo… — y cuántas plazas hay. Cuando se agotan, la promo deja de mostrarse. Creas urgencia real y llenas los huecos que más te interesan.',
    example: 'Ejemplo: -20% de 13:00 a 16:00 · solo 12 cupos',
  },
  {
    id: 'ladder',
    layout: 'card' as const,
    image: promoGourmet,
    tag: 'Oferta',
    title: 'Regalos que traen clientes de vuelta',
    copy:
      'Premios escalonados: postre gratis a las 3 reservas, copa a las 5, menú especial a las 10… Alientas a repetir sin regalar a todo el mundo.',
    example: 'Ejemplo: postre GRATIS al acumular 3 reservas',
  },
  {
    id: 'attendance',
    layout: 'card' as const,
    image: promoDessert,
    tag: 'Asistencia puntual',
    title: 'Cupos que no se pierden',
    copy:
      'Para promos muy demandadas, el cliente debe presentarse en un plazo. Si no viene, liberas la plaza para otro.',
    example: 'Ejemplo: ventana de llegada de 15 minutos',
  },
] as const

const MANAGED = [
  {
    id: 'calendar',
    title: 'Reservas y calendario',
    detail: 'Ocupación del día, confirmaciones y asistencia en un clic. Ves quién viene y cuándo sin mirar el móvil cada cinco minutos.',
    image: cardCalendar,
  },
  {
    id: 'floor',
    title: 'Plano de mesas',
    detail:
      'Monta tu sala con mesas, barra y columnas como en la vida real. Tus clientes eligen su mesa favorita en el plano al reservar — junto al día y la hora.',
    image: cardFloorplan,
  },
  {
    id: 'crm',
    title: 'CRM de comensales',
    detail: 'Quién reserva, cuántas veces y cuándo fue la última visita. Conoces a tus habituales y los cuidas mejor.',
    image: cardCrm,
  },
  {
    id: 'reports',
    title: 'Informes claros',
    detail: 'Reservas y clientes por periodo. Sabes qué días petan y cuándo conviene reforzar turno o personal.',
    image: cardReports,
  },
  {
    id: 'email',
    title: 'Emails automáticos',
    detail: 'Confirmaciones y avisos con la foto de tu local. Profesional, sin escribir uno a uno.',
    image: cardEmail,
  },
  {
    id: 'profile',
    title: 'Perfil público',
    detail: 'Fotos, carta, ubicación en mapa y enlace propio para QR, Instagram o carta digital.',
    image: cardProfile,
  },
] as const

const WITHOUT = [
  'Llamadas a deshora y mensajes perdidos',
  'Mesas vacías que no sabes cómo llenar',
  'Clientes anónimos que no vuelven',
  'Promos en Instagram que nadie ve',
] as const

const WITH = [
  'Reservas online ordenadas y confirmadas',
  'Promociones visibles donde ya buscan mesa',
  'Base de clientes con historial real',
  'Todo el negocio en un solo panel',
] as const

function CompanyLandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/empresa" className={styles.brand} aria-label="Adelia empresas">
            <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
            <span>Adelia</span>
          </Link>

          <div className={styles.headerAside}>
            <div className={styles.headerActions}>
              <Link to="/login" className={styles.headerGhost}>
                Iniciar sesión
              </Link>
              <Link to="/empresa/planes" className={styles.headerPrimary}>
                Quiero Adelia
              </Link>
            </div>
            <Link to="/" className={styles.headerUserLink}>
              ¿Eres usuario?
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroMedia}>
            <img src={heroImage} alt="" className={styles.heroImage} />
            <div className={styles.heroOverlay} />
          </div>

          <div className={styles.heroContent}>
            <p className={styles.heroBadge}>Para restaurantes, bares y locales con mesa</p>
            <h1>
              Llena mesas.
              <span> Fideliza clientes.</span>
              <span> Haz que te encuentren.</span>
            </h1>
            <p className={styles.heroLead}>
              Adelia pone tu restaurante donde la gente ya busca dónde comer — y te da un CRM
              para gestionar reservas, promos y comensales sin volverte loco.
            </p>
            <div className={styles.heroActions}>
              <Link to="/empresa/planes" className={styles.heroPrimary}>
                Solicitar acceso gratis
              </Link>
              <Link to="/login" className={styles.heroSecondary}>
                Ya tengo cuenta
              </Link>
            </div>
            <p className={styles.heroNote}>
              Sin tarjeta · Te das de alta tú · Empiezas en minutos
            </p>
          </div>
        </section>

        <section className={styles.stats} aria-label="Beneficios clave">
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className={styles.pillars}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Lo que ganas</p>
            <h2>
              Reservas, clientes y promos en un solo sitio.
              <span> ¿Qué estás esperando?</span>
            </h2>
            <p>
              No hace falta ser una cadena. Con Adelia puedes llenar mesas, fidelizar y
              destacar — desde el primer día.
            </p>
          </div>

          <div className={styles.pillarGrid}>
            {PILLARS.map((pillar) => (
              <article
                key={pillar.title}
                className={`${styles.pillarCard} ${styles[`pillar${pillar.accent.charAt(0).toUpperCase()}${pillar.accent.slice(1)}`]}`}
              >
                <span className={styles.pillarIcon} aria-hidden="true">
                  {pillar.icon}
                </span>
                <h3>{pillar.title}</h3>
                <p>{pillar.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.growth}>
          <div className={styles.growthCopy}>
            <p className={styles.eyebrow}>Visibilidad + gestión</p>
            <h2>Te ven. Reservan. Vuelven.</h2>
            <p>
              Los comensales descubren restaurantes en Adelia. Tú controlas cómo te ven:
              fotos, promos, ubicación en mapa y enlace propio para redes y cartelería.
            </p>
            <ul className={styles.growthList}>
              <li>Aparece en búsqueda, estilo y promociones destacadas</li>
              <li>QR y enlace para mesa, Instagram o carta digital</li>
              <li>Ranking y retos que traen clientes con ganas de volver</li>
            </ul>
            <Link to="/empresa/planes" className={styles.inlineCta}>
              Quiero aparecer en Adelia →
            </Link>
          </div>
          <div className={styles.growthVisual}>
            <img src={growthImage} alt="" className={styles.growthImage} />
          </div>
        </section>

        <section className={styles.promoShowcase}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Promociones que venden</p>
            <h2>Tus ofertas, donde la gente ya mira</h2>
            <p>
              Crea promociones por horas, limita cupos para generar urgencia y premia a quien
              repite reservas con regalos escalonados. Publicas una vez: se ven en descubrimiento
              y alientan a venir a tu restaurante.
            </p>
          </div>

          <div className={styles.promoGrid}>
            {PROMO_SHOWCASE.map((promo) =>
              promo.layout === 'feature' ? (
                <article key={promo.id} className={styles.promoFeature}>
                  <img src={promo.image} alt="" />
                  <div className={styles.promoFeatureBody}>
                    <span className={styles.promoTag}>{promo.tag}</span>
                    <h3>{promo.title}</h3>
                    <p>{promo.copy}</p>
                    <em className={styles.promoExample}>{promo.example}</em>
                  </div>
                </article>
              ) : (
                <article key={promo.id} className={styles.promoCard}>
                  <img src={promo.image} alt="" />
                  <div>
                    <span className={styles.promoCardTag}>{promo.tag}</span>
                    <strong>{promo.title}</strong>
                    <p className={styles.promoCardNote}>{promo.copy}</p>
                    <em className={styles.promoExample}>{promo.example}</em>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section className={styles.gamification}>
          <div className={styles.gamificationVisual}>
            <img src={gamificationHero} alt="" />
          </div>
          <div className={styles.gamificationCopy}>
            <p className={styles.eyebrow}>Clientes enganchados</p>
            <h2>Opinan, puntúan y vuelven por ti</h2>
            <p>
              La app premia a quien descubre locales, deja reseñas y repite reservas.
              Eso significa más ojos sobre tu carta y más mesas llenas en temporada baja.
            </p>
          </div>
        </section>

        <section className={styles.managed}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Todo en un sitio</p>
            <h2>Olvídate del caos. Gestiona con calma.</h2>
            <p>
              Un panel pensado para sala y dueño: lo que antes eran cuadernos, WhatsApp
              y Excel, ahora vive en Adelia.
            </p>
          </div>

          <div className={styles.managedGrid}>
            {MANAGED.map((item) => (
              <article key={item.id} className={styles.managedCard}>
                <img src={item.image} alt="" className={styles.managedCardThumb} />
                <div className={styles.managedCardBody}>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.compare}>
          <div className={styles.compareCol}>
            <h3>Sin Adelia</h3>
            <ul>
              {WITHOUT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={`${styles.compareCol} ${styles.compareColWin}`}>
            <h3>Con Adelia</h3>
            <ul>
              {WITH.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.cta} id="solicitar">
          <div className={styles.ctaGlow} aria-hidden="true" />
          <p className={styles.eyebrow}>Empieza hoy</p>
          <h2>Tu restaurante merece llenarse</h2>
          <p>
            Elige Mesa (gratis), Sala (39,99 €/mes) o Local (59,99 €/mes). Configuras mesas, perfil y
            promos en una tarde. Tus clientes reservan desde el mismo día.
          </p>
          <div className={styles.ctaActions}>
            <Link to="/empresa/planes" className={styles.ctaPrimary}>
              Ver planes
            </Link>
            <Link to="/login" className={styles.ctaSecondary}>
              Iniciar sesión
            </Link>
          </div>
          <p className={styles.ctaFinePrint}>
            * Sin comisión por reserva en el plan actual. ¿Eres comensal?{' '}
            <Link to="/">Descubre restaurantes</Link>
          </p>
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <LegalLinks from="/empresa" />
        <p>© {new Date().getFullYear()} Adelia · Reservas para restaurantes</p>
      </footer>
    </div>
  )
}

export default CompanyLandingPage
