import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import CityAutocomplete from '../components/CityAutocomplete'
import CharacteristicPicker from '../components/CharacteristicPicker'
import ImageUploader from '../components/ImageUploader'
import LocationMapPicker from '../components/LocationMapPicker'
import CustomerGate from '../components/CustomerGate'
import { useAuth } from '../context/AuthContext'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { COMPANY_CHARACTERISTIC_OPTIONS } from '../data/companyCharacteristics'
import { completeCustomerOnboarding } from '../services/customerAuth'
import type { CitySuggestion } from '../services/citySearch'
import { getCustomerDestination } from '../utils/customerRouting'
import { formatSpanishPhoneForStorage, isValidSpanishPhone } from '../utils/helpers'
import { getFirestoreErrorMessage } from '../services/firestoreErrors'
import UsernameField, { type UsernameStatus } from '../components/UsernameField'
import {
  checkUsernameAvailable,
  localUsernameError,
  suggestUsername,
  updateCustomerIdentity,
} from '../services/customerIdentityApi'
import { personNameError } from '../utils/personName'
import styles from './CustomerOnboardingPage.module.css'

function CustomerOnboardingPageContent() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEditing = searchParams.get('edit') === '1'
  const { user, profile, refreshProfile } = useAuth()
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? '')
  const [city, setCity] = useState<CitySuggestion | null>(
    profile?.homeCity
      ? {
          id: profile.homeCity,
          name: profile.homeCity,
          region: profile.homeMunicipality,
          country: profile.homeCountry,
          label: profile.homeCity,
        }
      : null,
  )
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
    profile?.homeLatitude != null && profile?.homeLongitude != null
      ? { lat: profile.homeLatitude, lng: profile.homeLongitude }
      : null,
  )
  const [foodPreferences, setFoodPreferences] = useState<string[]>(profile?.foodPreferences ?? [])
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const currentUsername = profile?.username ?? ''
  const [username, setUsername] = useState(
    currentUsername || suggestUsername(profile?.displayName ?? '', profile?.email ?? ''),
  )
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sin @usuario aún: si la propuesta está cogida, se prueba con números.
  useEffect(() => {
    if (currentUsername || !user) return
    let cancelled = false
    void (async () => {
      const base = suggestUsername(profile?.displayName ?? '', profile?.email ?? '')
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        const candidate = attempt === 0 ? base : `${base}${Math.floor(10 + Math.random() * 990)}`
        const result = await checkUsernameAvailable(candidate).catch(() => null)
        if (!result || result.available) {
          if (!cancelled && attempt > 0) setUsername(candidate)
          return
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUsername, user, profile?.displayName, profile?.email])

  if (user && profile && profile.onboardingCompleted && !isEditing) {
    return <Navigate to="/app/perfil" replace />
  }

  /** Guarda nombre y @usuario por el servidor (comprueba que el @usuario sea único). */
  const saveIdentity = async () => {
    const cleanName = displayName.replace(/\s+/g, ' ').trim()
    const cleanUsername = username.trim().toLowerCase()
    const changes: { displayName?: string; username?: string } = {}
    if (cleanName !== (profile?.displayName ?? '')) changes.displayName = cleanName
    if (cleanUsername && cleanUsername !== currentUsername) changes.username = cleanUsername
    if (changes.displayName !== undefined || changes.username !== undefined) {
      await updateCustomerIdentity(changes)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!user) {
      setError('Sesión expirada. Vuelve a iniciar sesión.')
      return
    }

    const nameProblem = personNameError(displayName)
    if (nameProblem) {
      setError(`${nameProblem} Es el que verán tus amigos.`)
      return
    }

    const usernameProblem = localUsernameError(username)
    if (usernameProblem) {
      setError(`Tu @usuario: ${usernameProblem}`)
      return
    }
    if (usernameStatus === 'taken') {
      setError(`@${username} ya está cogido. Prueba con otro.`)
      return
    }

    if (!city?.name) {
      setError('Indica dónde vives para mostrarte promos y restaurantes cerca.')
      return
    }

    if (foodPreferences.length === 0) {
      setError('Elige al menos un estilo de comida que te guste.')
      return
    }

    // El teléfono es opcional, pero si se escribe tiene que ser válido.
    if (phone.trim() && !isValidSpanishPhone(phone)) {
      setError('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678) o déjalo vacío.')
      return
    }

    setIsSaving(true)

    try {
      try {
        await saveIdentity()
      } catch (identityError) {
        setError(identityError instanceof Error ? identityError.message : 'No se pudo guardar tu nombre.')
        return
      }
      await completeCustomerOnboarding(user.uid, {
        photoUrl,
        homeCity: city.name,
        homeMunicipality: city.region ?? '',
        homeCountry: city.country ?? '',
        homePostalCode: profile?.homePostalCode ?? '',
        homeLatitude: coordinates?.lat ?? null,
        homeLongitude: coordinates?.lng ?? null,
        foodPreferences,
        // Vacío = quitar el teléfono.
        phone: phone.trim() ? formatSpanishPhoneForStorage(phone) : '',
      })
      await refreshProfile()
      navigate(isEditing ? '/app/perfil' : '/app/explorar', { replace: true })
    } catch (err) {
      // Errores de la base en español (antes salía «Missing or insufficient permissions.»).
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : ''
      setError(code === 'permission-denied'
        ? 'No se pudo guardar tu perfil. Revisa los datos e inténtalo de nuevo; si sigue fallando, escríbenos.'
        : getFirestoreErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  // Nadie tiene que rellenar nada para entrar: se completa luego desde el perfil.
  const handleSkip = async () => {
    if (!user) {
      setError('Sesión expirada. Vuelve a iniciar sesión.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      // Aunque salte el resto, se queda con el @usuario propuesto (si está libre).
      await saveIdentity().catch(() => undefined)
      await completeCustomerOnboarding(user.uid, {
        photoUrl,
        homeCity: city?.name ?? '',
        homeMunicipality: city?.region ?? '',
        homeCountry: city?.country ?? '',
        homePostalCode: profile?.homePostalCode ?? '',
        homeLatitude: coordinates?.lat ?? null,
        homeLongitude: coordinates?.lng ?? null,
        foodPreferences,
        ...(isValidSpanishPhone(phone) ? { phone: formatSpanishPhoneForStorage(phone) } : {}),
      })
      await refreshProfile()
      navigate('/app/explorar', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo continuar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brandRow}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <p className={styles.eyebrow}>{isEditing ? 'Tu perfil' : 'Último paso'}</p>
            <h1>{isEditing ? 'Editar perfil' : 'Personaliza tu perfil'}</h1>
          </div>
        </div>

        <p className={styles.lead}>
          Cuéntanos dónde estás y qué te gusta comer. Así te mostramos restaurantes y promos que
          encajan contigo.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <ImageUploader
            label="Foto de perfil"
            cropAspect={1}
            cropRound
            hint="Opcional. Aparecerá en tu perfil y reseñas."
            currentImageUrl={photoUrl}
            onImageUploaded={setPhotoUrl}
            onImageRemoved={() => setPhotoUrl('')}
          />

          <label className={styles.field}>
            <span className={styles.label}>Tu nombre</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
              autoComplete="name"
              placeholder="Nombre y apellido"
              className={styles.textInput}
            />
            <span className={styles.fieldHint}>Es el que ven tus amigos, el ranking y tus reseñas.</span>
          </label>

          <UsernameField
            value={username}
            onChange={setUsername}
            currentUsername={currentUsername}
            onStatusChange={setUsernameStatus}
          />

          <div className={styles.field}>
            <span className={styles.label}>¿Dónde vives?</span>
            <CityAutocomplete
              value={city}
              onChange={setCity}
              placeholder="Ciudad o pueblo"
              label="Ciudad"
            />
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Teléfono (opcional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="612 345 678"
              className={styles.textInput}
            />
            <span className={styles.fieldHint}>
              Así el restaurante puede avisarte si cambia algo de tu reserva. Te lo pediremos al reservar si no lo pones.
            </span>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Ubicación en mapa (opcional)</span>
            <LocationMapPicker
              value={coordinates}
              onChange={setCoordinates}
              geocodeQuery={city?.label ?? city?.name ?? ''}
              pinHint="Toca el mapa o arrastra el pin hasta tu zona: solo sirve para enseñarte sitios cerca."
            />
          </div>

          <CharacteristicPicker
            label="¿Qué te gusta comer?"
            options={COMPANY_CHARACTERISTIC_OPTIONS}
            selected={foodPreferences}
            maxSelected={5}
            onChange={setFoodPreferences}
            hint="Elige hasta 5 cosas que te gusten."
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Entrar a Adelia'}
          </button>
        </form>

        {isEditing ? (
          <Link to="/app/perfil" className={styles.skipLink}>
            Cancelar
          </Link>
        ) : (
          <button
            type="button"
            className={styles.skipLink}
            onClick={() => void handleSkip()}
            disabled={isSaving}
          >
            Ahora no, entrar a Adelia
          </button>
        )}
      </main>
    </div>
  )
}

function CustomerOnboardingPage() {
  const { user, profile } = useAuth()

  if (user && profile && profile.role === 'customer') {
    const destination = getCustomerDestination(user, profile)

    if (destination === '/cuenta/verificar-email') {
      return <Navigate to={destination} replace />
    }
  }

  return (
    <CustomerGate allowIncomplete>
      <CustomerOnboardingPageContent />
    </CustomerGate>
  )
}

export default CustomerOnboardingPage
