import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CharacteristicPicker from '../components/CharacteristicPicker'
import CityAutocomplete from '../components/CityAutocomplete'
import ImageUploader from '../components/ImageUploader'
import LocationMapPicker from '../components/LocationMapPicker'
import MediaGalleryUploader from '../components/MediaGalleryUploader'
import ProfileToggleGrid from '../components/ProfileToggleGrid'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { useAuth } from '../context/AuthContext'
import {
  COMPANY_CHARACTERISTIC_OPTIONS,
  MAX_COMPANY_CHARACTERISTICS,
  MAX_COMPANY_PHOTOS,
} from '../data/companyCharacteristics'
import { COMPANY_AMENITIES, COMPANY_VENUE_TYPES, MAX_COMPANY_VENUE_TYPES } from '../data/companyProfileFacilities'
import { loginWithUsername } from '../services/auth'
import { completePaidCompanySignup, fetchSaasCheckoutSession } from '../services/saasBilling'
import type { CitySuggestion } from '../services/citySearch'
import type { GeoCoordinates } from '../utils/geo'
import {
  formatSpanishPhoneForStorage,
  isValidEmail,
  isValidSpanishPhone,
} from '../utils/helpers'
import {
  getPasswordChecks,
  isPasswordValid,
} from '../utils/passwordValidation'
import styles from './CompanySignupPage.module.css'

const STEPS = [
  { id: 'account', label: 'Cuenta' },
  { id: 'venue', label: 'Local' },
  { id: 'style', label: 'Estilo' },
  { id: 'guide', label: 'Tour' },
  { id: 'spotlight', label: 'En Adelia' },
] as const

type StepId = (typeof STEPS)[number]['id']

const TUTORIAL = [
  {
    kicker: 'Reservas',
    title: 'El calendario trabaja por ti',
    copy: 'Altas, estados, mesas y correos automáticos. El cliente reserva; tú confirmas en un toque.',
  },
  {
    kicker: 'Carta y QR',
    title: 'Tu local, en el móvil',
    copy: 'Carta digital, plano de sala y un QR en la puerta. Quien pasa, te encuentra.',
  },
  {
    kicker: 'Clientes',
    title: 'Vuelven porque les recuerdas',
    copy: 'Historial, promos y Compite. Llenas huecos y fidelizas sin Excel.',
  },
] as const

const slide = {
  initial: { opacity: 0, y: 28, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -18, scale: 0.99 },
}

function CompanySignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') ?? ''
  const { refreshProfile } = useAuth()

  const [step, setStep] = useState<StepId>('account')
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [planName, setPlanName] = useState('')
  const [alreadyOpen, setAlreadyOpen] = useState(false)

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [city, setCity] = useState<CitySuggestion | null>(null)
  const [coords, setCoords] = useState<GeoCoordinates | null>(null)

  const [venueTypes, setVenueTypes] = useState<string[]>([])
  const [amenities, setAmenities] = useState<string[]>([])
  const [characteristics, setCharacteristics] = useState<string[]>([])
  const [logoUrl, setLogoUrl] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  const [slug, setSlug] = useState('')
  const [loginName, setLoginName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guideIndex, setGuideIndex] = useState(0)

  const passwordChecks = useMemo(
    () => getPasswordChecks(password, confirmPassword),
    [password, confirmPassword],
  )
  const passwordReady = isPasswordValid(passwordChecks)
  const stepIndex = STEPS.findIndex((item) => item.id === step)

  useEffect(() => {
    if (!sessionId) {
      setSessionError('Falta el pago. Vuelve a planes y contrata Sala o Local.')
      setLoadingSession(false)
      return
    }

    let cancelled = false
    void fetchSaasCheckoutSession(sessionId)
      .then((session) => {
        if (cancelled) {
          return
        }
        if (!session.paid) {
          setSessionError('Todavía no consta el pago. Espera un momento o vuelve a Stripe.')
          return
        }
        if (session.companyId) {
          setAlreadyOpen(true)
        }
        setPlanName(session.planName)
        setEmail((current) => current || session.email)
        setPhone((current) => current || session.phone)
        setName((current) => current || session.restaurantName)
        if (session.city) {
          setCity({
            id: session.city,
            name: session.city,
            region: session.city,
            country: 'España',
            label: session.city,
          })
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setSessionError(caught instanceof Error ? caught.message : 'No se pudo leer el pago.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSession(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const geocodeQuery = [location, city?.name, city?.country].filter(Boolean).join(', ')

  const goAccountNext = () => {
    setError(null)
    if (!isValidEmail(email) || !email.trim()) {
      setError('Indica un correo válido.')
      return
    }
    if (!isValidSpanishPhone(phone)) {
      setError('Indica un teléfono de España (9 dígitos).')
      return
    }
    if (!passwordReady) {
      setError('La contraseña aún no cumple los requisitos.')
      return
    }
    setStep('venue')
  }

  const finishSignup = async (skipStyle: boolean) => {
    setError(null)
    if (name.trim().length < 2) {
      setError('Pon el nombre de tu restaurante.')
      setStep('venue')
      return
    }
    if (location.trim().length < 5) {
      setError('Indica la dirección del local.')
      setStep('venue')
      return
    }

    setBusy(true)
    try {
      const result = await completePaidCompanySignup({
        sessionId,
        email: email.trim(),
        phone: formatSpanishPhoneForStorage(phone),
        password,
        name: name.trim(),
        location: location.trim(),
        website: website.trim(),
        municipality: city?.name ?? '',
        postalCode: '',
        country: city?.country || 'España',
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        logoUrl: skipStyle ? '' : logoUrl,
        photos: skipStyle ? [] : photos,
        characteristics: skipStyle ? [] : characteristics,
        venueTypes: skipStyle ? [] : venueTypes,
        amenities: skipStyle ? [] : amenities,
      })
      setSlug(result.slug)
      setLoginName(result.loginName)
      try {
        await loginWithUsername(result.loginName, password)
        await refreshProfile()
        setStep('guide')
      } catch {
        setError(`Tu local ya está creado. Entra con “${result.loginName}” y tu contraseña.`)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la cuenta.')
    } finally {
      setBusy(false)
    }
  }

  const enterPanel = () => {
    navigate('/panel', { replace: true })
  }

  if (loadingSession) {
    return (
      <div className={styles.page}>
        <p className={styles.boot}>Preparando tu alta…</p>
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className={styles.page}>
        <section className={styles.shell}>
          <h1>No podemos abrir el alta</h1>
          <p>{sessionError}</p>
          <Link to="/empresa/planes" className={styles.primary}>Volver a planes</Link>
        </section>
      </div>
    )
  }

  if (alreadyOpen) {
    return (
      <div className={styles.page}>
        <section className={styles.shell}>
          <p className={styles.kicker}>Pago listo</p>
          <h1>Tu local ya está creado</h1>
          <p>Entra con el nombre del restaurante y la contraseña que elegiste.</p>
          <Link to="/login" className={styles.primary}>Ir al acceso empresa</Link>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.glowA} aria-hidden="true" />
      <div className={styles.glowB} aria-hidden="true" />

      <header className={styles.top}>
        <Link to="/empresa" className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="" />
          <span>Adelia</span>
        </Link>
        <p className={styles.planChip}>{planName ? `Plan ${planName}` : 'Alta empresa'}</p>
      </header>

      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className={styles.dots}>
        {STEPS.map((item, index) => (
          <li key={item.id} className={index <= stepIndex ? styles.dotOn : ''}>
            {item.label}
          </li>
        ))}
      </ol>

      <main className={styles.stage}>
        <AnimatePresence mode="wait">
          {step === 'account' ? (
            <motion.section key="account" className={styles.card} {...slide} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <p className={styles.kicker}>Paso 1</p>
              <h1>Tu acceso a Adelia</h1>
              <p className={styles.lead}>Correo, teléfono y una contraseña tuya. Con esto entras al panel.</p>
              <label className={styles.field}>
                <span>Correo</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </label>
              <label className={styles.field}>
                <span>Teléfono</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="612 345 678" />
              </label>
              <label className={styles.field}>
                <span>Contraseña</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label className={styles.field}>
                <span>Repite la contraseña</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <ul className={styles.checks}>
                {passwordChecks.map((check) => (
                  <li key={check.label} className={check.met ? styles.checkOn : ''}>{check.label}</li>
                ))}
              </ul>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="button" className={styles.primary} onClick={goAccountNext}>Continuar</button>
            </motion.section>
          ) : null}

          {step === 'venue' ? (
            <motion.section key="venue" className={styles.card} {...slide} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <p className={styles.kicker}>Paso 2</p>
              <h1>Tu restaurante</h1>
              <p className={styles.lead}>Así te van a buscar. El nombre será también tu usuario de acceso.</p>
              <label className={styles.field}>
                <span>Nombre del local</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="La Brasa del Mar" />
              </label>
              <label className={styles.field}>
                <span>Dirección</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Calle, número, barrio" />
              </label>
              <CityAutocomplete value={city} onChange={setCity} label="Ciudad" placeholder="Madrid, Valencia…" variant="form" />
              <label className={styles.field}>
                <span>Web (opcional)</span>
                <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="www.tulocal.com" />
              </label>
              <div className={styles.mapBlock}>
                <p>Marca el local en el mapa si quieres. Luego lo puedes cambiar.</p>
                <LocationMapPicker value={coords} onChange={setCoords} geocodeQuery={geocodeQuery} compact />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={() => setStep('account')}>Atrás</button>
                <button type="button" className={styles.primary} onClick={() => { setError(null); setStep('style') }}>Continuar</button>
              </div>
            </motion.section>
          ) : null}

          {step === 'style' ? (
            <motion.section key="style" className={`${styles.card} ${styles.cardWide}`} {...slide} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <p className={styles.kicker}>Paso 3 · opcional</p>
              <h1>Personaliza cómo te ven</h1>
              <p className={styles.lead}>Cocina, wifi, parking, fotos… Si ahora no, lo haces luego en el panel.</p>
              <ProfileToggleGrid
                label="Qué eres"
                options={COMPANY_VENUE_TYPES}
                selected={venueTypes}
                onChange={setVenueTypes}
                maxSelected={MAX_COMPANY_VENUE_TYPES}
              />
              <ProfileToggleGrid
                label="Qué tienes"
                hint="Parking, wifi, terraza…"
                options={COMPANY_AMENITIES}
                selected={amenities}
                onChange={setAmenities}
              />
              <CharacteristicPicker
                label="Cocina y ambiente"
                options={COMPANY_CHARACTERISTIC_OPTIONS}
                selected={characteristics}
                maxSelected={MAX_COMPANY_CHARACTERISTICS}
                onChange={setCharacteristics}
              />
              <ImageUploader
                label="Logo"
                hint="Opcional. Cuadrado queda mejor."
                currentImageUrl={logoUrl}
                onImageUploaded={setLogoUrl}
                onImageRemoved={() => setLogoUrl('')}
              />
              <MediaGalleryUploader
                label="Fotos"
                hint={`Hasta ${MAX_COMPANY_PHOTOS}. La primera es la de portada.`}
                urls={photos}
                maxItems={MAX_COMPANY_PHOTOS}
                mediaType="image"
                onChange={setPhotos}
              />
              {error ? (
                <p className={styles.error}>
                  {error}
                  {loginName ? (
                    <>
                      {' '}
                      <Link to="/login">Ir al acceso empresa</Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} disabled={busy} onClick={() => setStep('venue')}>Atrás</button>
                <button type="button" className={styles.ghost} disabled={busy} onClick={() => void finishSignup(true)}>
                  Más tarde
                </button>
                <button type="button" className={styles.primary} disabled={busy} onClick={() => void finishSignup(false)}>
                  {busy ? 'Creando tu local…' : 'Guardar y seguir'}
                </button>
              </div>
            </motion.section>
          ) : null}

          {step === 'guide' ? (
            <motion.section key="guide" className={styles.card} {...slide} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <p className={styles.kicker}>Tour rápido</p>
              <h1>{TUTORIAL[guideIndex].title}</h1>
              <p className={styles.eyebrow}>{TUTORIAL[guideIndex].kicker}</p>
              <p className={styles.lead}>{TUTORIAL[guideIndex].copy}</p>
              <div className={styles.guideDots}>
                {TUTORIAL.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={index === guideIndex ? styles.guideDotOn : styles.guideDot}
                    onClick={() => setGuideIndex(index)}
                    aria-label={item.kicker}
                  />
                ))}
              </div>
              <div className={styles.actions}>
                {guideIndex > 0 ? (
                  <button type="button" className={styles.ghost} onClick={() => setGuideIndex((current) => current - 1)}>
                    Anterior
                  </button>
                ) : <span />}
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => {
                    if (guideIndex < TUTORIAL.length - 1) {
                      setGuideIndex((current) => current + 1)
                      return
                    }
                    setStep('spotlight')
                  }}
                >
                  {guideIndex < TUTORIAL.length - 1 ? 'Siguiente' : 'Ver cómo te ven'}
                </button>
              </div>
            </motion.section>
          ) : null}

          {step === 'spotlight' ? (
            <motion.section key="spotlight" className={styles.card} {...slide} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <p className={styles.kicker}>Ya estás en Adelia</p>
              <h1>Búscate. Así te ven.</h1>
              <p className={styles.lead}>
                Tu ficha pública ya existe. Ábrela, enséñasela al equipo y entra al panel cuando quieras.
              </p>
              <article className={styles.preview}>
                {photos[0] || logoUrl ? (
                  <img src={photos[0] || logoUrl} alt="" />
                ) : (
                  <div className={styles.previewFallback}>{name.slice(0, 1)}</div>
                )}
                <div>
                  <strong>{name}</strong>
                  <span>{city?.name || location}</span>
                </div>
              </article>
              {slug ? (
                <a className={styles.publicLink} href={`/reservar/${slug}`} target="_blank" rel="noreferrer">
                  Abrir tu página en Adelia
                </a>
              ) : null}
              <p className={styles.hint}>
                Más tarde entras con el nombre <strong>{loginName || name}</strong> y tu contraseña.
              </p>
              <button type="button" className={styles.primary} onClick={enterPanel}>
                Entrar al panel
              </button>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default CompanySignupPage
