import styles from './RecaptchaNotice.module.css'

/**
 * Aviso que Google exige si se oculta el sello flotante de reCAPTCHA
 * (que tapaba contenido en móvil). Va en cada formulario que lo usa.
 */
function RecaptchaNotice() {
  return (
    <p className={styles.notice}>
      Protegido por reCAPTCHA: se aplican la{' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">política de privacidad</a>
      {' '}y los{' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">términos</a>
      {' '}de Google.
    </p>
  )
}

export default RecaptchaNotice
