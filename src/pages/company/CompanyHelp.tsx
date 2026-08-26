import { LEGAL_CONTACT_EMAIL } from '../../content/publicLegal'
import LegalLinks from '../../components/LegalLinks'
import styles from './CompanyHelp.module.css'

const HELP_EMAIL = LEGAL_CONTACT_EMAIL

const HELP_ITEMS = [
  {
    id: 'reservation-settings',
    question: '¿Cómo configuro reservas y horario?',
    answer: [
      'Abre Mi restaurante → Reservas y horario.',
      'Reserva: elige si es obligatoria, opcional o si el local no admite reservas.',
      'Duración de cada reserva: indica cuántos minutos ocupa una mesa (por defecto suele ser 120 min).',
      'Horario semanal: marca los días activos y hasta 3 tramos por día (por ejemplo, 12:00–16:00 y 20:00–00:00). Los tramos no pueden cruzarse.',
      'Pulsa Guardar reservas y horario. Esto afecta al calendario y a la web pública.',
    ],
  },
  {
    id: 'tables',
    question: '¿Cómo creo y modifico mesas?',
    answer: [
      'Ve a Mi restaurante → Mesas.',
      'Cada fila es una mesa: escribe el nombre (por ejemplo, «Mesa 1» o «Terraza 3») y la capacidad máxima de comensales.',
      'Si tienes varios mapas, elige en la columna Mapa a cuál pertenece cada mesa.',
      'Usa + Añadir mesa para crear nuevas mesas.',
      'Pulsa Guardar mesas cuando termines. Los cambios se reflejan en tus reservas y en el mapa.',
    ],
  },
  {
    id: 'contact-link',
    question: '¿Cómo comparto el enlace de reservas con mis clientes?',
    answer: [
      'Entra en Mi restaurante → Contacto.',
      'Copia el enlace para clientes que aparece en esa sección.',
      'Compártelo por WhatsApp, redes sociales, tu web o un código QR en el local.',
      'Tus clientes podrán elegir mesa, día y hora sin necesidad de crear cuenta.',
    ],
  },
  {
    id: 'manual-reservation',
    question: '¿Cómo creo o edito una reserva manualmente?',
    answer: [
      'En Reservas, selecciona el día en el calendario.',
      'Pulsa + Nueva reserva (o Crear primera reserva si el día está vacío).',
      'Completa nombre, teléfono, mesa, hora y número de comensales.',
      'Para modificar una reserva existente, usa el botón de editar en la fila correspondiente.',
    ],
  },
  {
    id: 'search-reservations',
    question: '¿Cómo busco o filtro las reservas del día?',
    answer: [
      'En la lista de reservas del día verás un buscador por nombre de cliente.',
      'También puedes filtrar por hora de inicio con el desplegable Horas.',
      'Usa Limpiar filtros si quieres volver a ver todas las reservas del día.',
    ],
  },
  {
    id: 'floor-plan',
    question: '¿Cómo uso el mapa del salón?',
    answer: [
      'En Mi restaurante → Mesas puedes crear varios mapas y llamarlos como quieras: Terraza, Comedor, Piso 1…',
      'Cada mapa tiene un interruptor «Activo al reservar». Si lo apagas, el plano se guarda pero los clientes no lo ven.',
      'Asigna cada mesa a un mapa y arrastra mesas y objetos (barra, sillas, puertas…) para colocarlos.',
      'Selecciona un elemento para girarlo, redimensionarlo o eliminarlo con los iconos del borde.',
      'Guarda mesas y, si editaste el plano, Guardar mapa. Al reservar, tus clientes solo verán los mapas activos.',
    ],
  },
  {
    id: 'contact-logo',
    question: '¿Cómo actualizo el contacto y el logo?',
    answer: [
      'Ve a Mi restaurante → Contacto.',
      'Actualiza nombre, teléfono, email, dirección y web si la tienes.',
      'Sube o cambia el logo con el selector de imagen (se guarda al subir el archivo).',
      'Pulsa Guardar contacto. Estos datos aparecen en tu página pública de reservas.',
    ],
  },
  {
    id: 'plan',
    question: '¿Dónde veo mi plan y cómo lo cambio?',
    answer: [
      'Abre Mi restaurante → Plan.',
      'Arriba ves el plan en el que estás y todo lo que incluye.',
      'Elige otro plan para ver lo extra si subes o lo que se te quita si bajas.',
      'Pulsa Solicitar para escribirnos. El cambio se confirma al activarlo; no es automático.',
    ],
  },
  {
    id: 'login',
    question: '¿Cómo accedo al panel?',
    answer: [
      'Entra con el nombre de tu restaurante y la contraseña que te proporcionamos.',
      'No uses el email de contacto para iniciar sesión: el acceso es por nombre del restaurante.',
      'Si olvidas la contraseña, usa «¿Olvidaste tu contraseña?» en la pantalla de acceso.',
    ],
  },
] as const

function CompanyHelp() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Centro de ayuda</h2>
        <p>Guías rápidas para configurar tu restaurante y gestionar reservas.</p>
      </header>

      <div className={styles.faqList}>
        {HELP_ITEMS.map((item) => (
          <details key={item.id} className={styles.faqItem}>
            <summary className={styles.faqQuestion}>{item.question}</summary>
            <div className={styles.faqAnswer}>
              <ol>
                {item.answer.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>

      <footer className={styles.contactBox}>
        <p className={styles.contactTitle}>¿Tienes más dudas?</p>
        <p className={styles.contactText}>
          Escríbenos a{' '}
          <a href={`mailto:${HELP_EMAIL}`} className={styles.contactLink}>
            {HELP_EMAIL}
          </a>{' '}
          y te ayudamos lo antes posible.
        </p>
        <div className={styles.legalBlock}>
          <p className={styles.contactTitle}>Información legal</p>
          <LegalLinks variant="sidebar" from="/panel" />
        </div>
      </footer>
    </div>
  )
}

export default CompanyHelp
