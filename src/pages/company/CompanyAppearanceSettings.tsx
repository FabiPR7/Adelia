import { setPanelThemeChoice, usePanelThemeChoice, type PanelThemeChoice } from '../../hooks/usePanelTheme'
import styles from './CompanyAccountSettings.module.css'

const OPTIONS: { id: PanelThemeChoice; label: string; hint: string; icon: string }[] = [
  { id: 'light', label: 'Claro', hint: 'Fondo crema, como siempre', icon: '☀️' },
  { id: 'dark', label: 'Oscuro', hint: 'Más descansado de noche y en sala con poca luz', icon: '🌙' },
  { id: 'system', label: 'Automático', hint: 'Igual que tu móvil u ordenador', icon: '🖥️' },
]

/** Ajustes → Apariencia: modo claro, oscuro o automático (en este dispositivo). */
function CompanyAppearanceSettings() {
  const choice = usePanelThemeChoice()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Apariencia</h2>
        <p>Cómo se ve el panel. Se guarda en este dispositivo: cada ordenador o móvil puede tener el suyo.</p>
      </header>

      <section className={styles.card} aria-labelledby="appearance-theme">
        <h3 id="appearance-theme">Tema</h3>
        <div className={styles.themeGrid} role="radiogroup" aria-labelledby="appearance-theme">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={choice === option.id}
              className={`${styles.themeOption} ${choice === option.id ? styles.themeOptionOn : ''}`}
              onClick={() => setPanelThemeChoice(option.id)}
            >
              <span className={styles.themeIcon} aria-hidden="true">{option.icon}</span>
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="appearance-language">
        <h3 id="appearance-language">Idioma</h3>
        <p className={styles.hint}>El panel está en español. Si necesitas otro idioma para tu equipo, escríbenos.</p>
      </section>
    </div>
  )
}

export default CompanyAppearanceSettings
