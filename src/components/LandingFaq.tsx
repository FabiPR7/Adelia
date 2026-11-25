import { ChevronDown } from 'lucide-react'
import styles from './LandingFaq.module.css'

const QUESTIONS = [
  {
    question: '¿Reservar con Adelia cuesta algo?',
    answer:
      'No, reservar es gratis. Algunos restaurantes piden una fianza para confirmar la mesa: si es así, lo verás en la reserva antes de pagar nada.',
  },
  {
    question: '¿Necesito una cuenta para reservar?',
    answer:
      'No. Puedes reservar con tu nombre y tu correo. La cuenta, que también es gratis, hace falta para canjear promociones, guardar favoritos y competir.',
  },
  {
    question: '¿Cómo consigo los premios de los restaurantes?',
    answer:
      'Cada restaurante publica sus promociones: descuentos, productos gratis, 2×1… Algunas se desbloquean al acumular reservas o consumos en ese local, y todas se canjean allí, con el código del restaurante.',
  },
  {
    question: '¿Cómo compito con mis amigos?',
    answer:
      'Crea tu cuenta, añade a tus amigos y comparad vuestro XP en el ranking. Cuando reserváis juntos, podéis retaros a un minijuego.',
  },
  {
    question: '¿El XP o los niveles valen dinero?',
    answer:
      'No. XP, niveles y premios del juego son virtuales: no se compran, no se venden y no se canjean por dinero.',
  },
  {
    question: '¿Puedo cancelar una reserva?',
    answer:
      'Sí. Con cuenta, desde «Mis reservas»; sin cuenta, desde el enlace del correo de la reserva. Con 24 horas o más de antelación no pierdes XP. Si el local pide fianza o tiene condiciones, te las mostramos al reservar.',
  },
]

// Las mismas preguntas marcadas para Google: pueden salir desplegadas en los resultados.
const FAQ_STRUCTURED_DATA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
})

function LandingFaq() {
  return (
    <section className={styles.section} aria-labelledby="landing-faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_STRUCTURED_DATA }} />
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Preguntas frecuentes</p>
        <h2 id="landing-faq-title">Lo que más nos preguntan</h2>
      </div>

      <div className={styles.list}>
        {QUESTIONS.map((item) => (
          <details key={item.question} className={styles.item}>
            <summary>
              <span>{item.question}</span>
              <ChevronDown size={20} aria-hidden="true" className={styles.chevron} />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export default LandingFaq
