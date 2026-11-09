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
      'Sí, desde el enlace que te llega en el correo de la reserva. Si el local tiene condiciones de cancelación o fianza, te las mostramos al reservar.',
  },
]

function LandingFaq() {
  return (
    <section className={styles.section} aria-labelledby="landing-faq-title">
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
