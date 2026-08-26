import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  COMPANY_PLANS,
  companyPlanChangeMailto,
  companyPlanIndex,
  compareCompanyPlans,
  formatCompanyPlanBilling,
  formatCompanyPlanPrice,
  formatCompanyPlanStartedAt,
  getCompanyPlan,
  includedPlanCapabilities,
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  type CompanyPlanId,
} from '../../data/companyPlans'
import { createPlanChangeRequest, listCompanyPlanChangeRequests } from '../../services/adminOps'
import styles from './CompanyPlan.module.css'

const PLAN_STORY: Record<
  CompanyPlanId,
  { verb: string; hook: string; promise: string; glow: string }
> = {
  free: {
    verb: 'Nacer',
    hook: 'Ya estás en el mapa.',
    promise: 'Te encuentran. Aún no te eligen mesa ni se enamoran de tu carta.',
    glow: 'mesa',
  },
  basic: {
    verb: 'Elegir',
    hook: 'Tu sala empieza a trabajar sola.',
    promise: 'El cliente elige mesa, ve platos de verdad y tú empiezas a entender el negocio.',
    glow: 'sala',
  },
  premium: {
    verb: 'Llenar',
    hook: 'El plan de quien quiere cada noche llena.',
    promise: 'Sin techo de mesas ni cartas. Compite, fianzas y visibilidad para no dejar huecos.',
    glow: 'local',
  },
  premium_plus: {
    verb: 'Dominar',
    hook: 'Para grupos que mandan en su ciudad.',
    promise: 'Varios locales, un equipo y el sitio de honor en Adelia. Lista de espera abierta.',
    glow: 'casa',
  },
}

function nextPlanId(currentId: CompanyPlanId): CompanyPlanId {
  const index = companyPlanIndex(currentId)
  return COMPANY_PLANS[Math.min(index + 1, COMPANY_PLANS.length - 1)]?.id ?? currentId
}

function Icon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'mesa':
      return (
        <svg {...common}>
          <path d="M4 10h16M6 10v8M18 10v8M8 6h8l1 4H7l1-4z" />
        </svg>
      )
    case 'sala':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M8 9h3v3H8zM13 9h3v3h-3zM8 14h8" />
        </svg>
      )
    case 'local':
      return (
        <svg {...common}>
          <path d="M4 20V9l8-5 8 5v11" />
          <path d="M9 20v-7h6v7" />
        </svg>
      )
    case 'casa':
      return (
        <svg {...common}>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10.5V20h12v-9.5" />
          <path d="M9 20v-5h6v5M12 4v3" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3l1.4 6.2L20 12l-6.6 2.8L12 21l-1.4-6.2L4 12l6.6-2.8L12 3z" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 13l4 4 10-10" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      )
  }
}

function capabilityIcon(id: string): string {
  if (id.includes('menu')) return 'mesa'
  if (id.includes('floor') || id === 'tables') return 'sala'
  if (id === 'compite' || id === 'featured' || id === 'videos') return 'spark'
  if (id === 'multi_venue' || id === 'team' || id === 'priority') return 'casa'
  if (id === 'deposits' || id === 'reports' || id === 'reports_advanced') return 'local'
  return 'check'
}

function planIcon(id: CompanyPlanId): string {
  if (id === 'free') return 'mesa'
  if (id === 'basic') return 'sala'
  if (id === 'premium') return 'local'
  return 'casa'
}

function CompanyPlan() {
  const { company, user } = useAuth()
  const currentPlanId = parseCompanyPlanId(company?.planId)
  const currentBilling = parseCompanyPlanBilling(company?.planBilling, currentPlanId)
  const currentStartedAt = company?.planStartedAt ?? null
  const currentPlan = getCompanyPlan(currentPlanId)
  const currentStory = PLAN_STORY[currentPlanId]
  const recommendedId = nextPlanId(currentPlanId)
  const [selectedId, setSelectedId] = useState<CompanyPlanId>(recommendedId)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [hasPending, setHasPending] = useState(false)

  const included = useMemo(() => includedPlanCapabilities(currentPlanId), [currentPlanId])
  const selectedPlan = getCompanyPlan(selectedId)
  const selectedStory = PLAN_STORY[selectedId]
  const comparison = useMemo(
    () => compareCompanyPlans(currentPlanId, selectedId),
    [currentPlanId, selectedId],
  )
  const currentIndex = companyPlanIndex(currentPlanId)
  const selectedIndex = companyPlanIndex(selectedId)

  useEffect(() => {
    if (!company?.id) {
      return
    }

    let cancelled = false
    void listCompanyPlanChangeRequests(company.id)
      .then((items) => {
        if (!cancelled) {
          setHasPending(items.some((item) => item.status === 'pending'))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [company?.id])

  const sendPlanRequest = async () => {
    if (!company || !user) {
      return
    }

    setRequestBusy(true)
    setRequestMessage(null)
    try {
      await createPlanChangeRequest({
        companyId: company.id,
        companyName: company.name,
        fromPlanId: currentPlanId,
        toPlanId: selectedId,
        fromBilling: currentBilling,
        requestedByUid: user.uid,
      })
      setHasPending(true)
      setRequestMessage('Solicitud enviada. Adelia te confirma el cambio; no se activa solo.')
    } catch (err) {
      setRequestMessage(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setRequestBusy(false)
    }
  }

  if (!company) {
    return <p className={styles.loading}>Cargando tu nivel…</p>
  }

  const ctaLabel =
    comparison.direction === 'same'
      ? `Sigues en ${currentPlan.name}`
      : selectedPlan.comingSoon
        ? `Quiero ser de los primeros en ${selectedPlan.name}`
        : comparison.direction === 'upgrade'
          ? `Quiero ${selectedPlan.name}. Llenar más.`
          : `Entiendo: bajar a ${selectedPlan.name}`

  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.orbA} />
        <span className={styles.orbB} />
        <span className={styles.orbC} />
      </div>

      <header className={styles.hero}>
        <p className={styles.kicker}>
          <Icon name="spark" />
          Tu nivel en Adelia
        </p>
        <h2>No subes de plan. Subes de local.</h2>
        <p className={styles.heroLead}>
          Cada nivel enciende herramientas que hacen que te elijan, te recuerden y vuelvan.
          Tu plan, si es mensual o perpetua y desde cuándo lo tienes los asigna Adelia.
          Desde aquí puedes verlo y pedir un cambio: no se activa solo.
        </p>
      </header>

      <section className={`${styles.statusCard} ${styles[`glow_${currentStory.glow}`]}`} aria-label="Plan actual">
        <div className={styles.statusIcon}>
          <Icon name={planIcon(currentPlanId)} />
        </div>
        <div className={styles.statusCopy}>
          <p className={styles.statusEyebrow}>Hoy operas en {currentPlan.name}</p>
          <p className={styles.statusMeta}>
            {currentPlanId === 'free'
              ? 'Plan de inicio. Lo asigna Adelia.'
              : [
                  formatCompanyPlanBilling(currentBilling),
                  currentStartedAt
                    ? `desde el ${formatCompanyPlanStartedAt(currentStartedAt)}`
                    : 'fecha de inicio pendiente de Adelia',
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
          <h3>{currentStory.hook}</h3>
          <p>{currentStory.promise}</p>
        </div>
        <div className={styles.statusPrice}>
          <strong>
            {currentBilling === 'perpetual' ? 'Perpetua' : formatCompanyPlanPrice(currentPlan)}
          </strong>
          <span>
            {currentBilling === 'perpetual'
              ? 'Sin caducidad'
              : currentPlan.vatNote}
          </span>
        </div>
      </section>

      <section className={styles.ladder} aria-label="Elegir nivel">
        <div className={styles.ladderHead}>
          <h3>Elige el nivel que quieres ver</h3>
          <p>Toca una carta. Te mostramos lo que se enciende… o lo que se apaga.</p>
        </div>

        <div className={styles.track} aria-hidden="true">
          {COMPANY_PLANS.map((plan, index) => (
            <span
              key={plan.id}
              className={`${styles.trackDot} ${index <= currentIndex ? styles.trackDotOn : ''} ${index === selectedIndex ? styles.trackDotPick : ''}`}
            />
          ))}
          <span
            className={styles.trackFill}
            style={{ width: `${(currentIndex / (COMPANY_PLANS.length - 1)) * 100}%` }}
          />
        </div>

        <div className={styles.planGrid}>
          {COMPANY_PLANS.map((plan) => {
            const story = PLAN_STORY[plan.id]
            const isCurrent = plan.id === currentPlanId
            const isSelected = plan.id === selectedId
            const isRecommended = plan.id === recommendedId && recommendedId !== currentPlanId

            return (
              <button
                key={plan.id}
                type="button"
                className={`${styles.planCard} ${styles[`card_${story.glow}`]} ${isSelected ? styles.planCardOn : ''} ${plan.highlighted ? styles.planCardStar : ''}`}
                onClick={() => setSelectedId(plan.id)}
                aria-pressed={isSelected}
              >
                {isRecommended ? <span className={styles.reco}>Siguiente nivel</span> : null}
                {plan.highlighted && !isRecommended ? <span className={styles.recoGold}>El que llena</span> : null}
                <span className={styles.cardIcon}>
                  <Icon name={planIcon(plan.id)} />
                </span>
                <span className={styles.cardVerb}>{story.verb}</span>
                <strong className={styles.cardName}>{plan.name}</strong>
                <span className={styles.cardPrice}>{formatCompanyPlanPrice(plan)}</span>
                <span className={styles.cardHook}>{story.hook}</span>
                {isCurrent ? <span className={styles.youAre}>Estás aquí</span> : null}
                {plan.comingSoon ? <span className={styles.soon}>Lista de espera</span> : null}
              </button>
            )
          })}
        </div>
      </section>

      {comparison.direction === 'same' ? (
        <section className={styles.includedPanel} aria-label="Lo que ya tienes">
          <div className={styles.panelHead}>
            <h3>Tu arsenal de {currentPlan.name}</h3>
            <p>Esto ya está encendido. El siguiente nivel no sustituye: multiplica.</p>
          </div>
          <ul className={styles.perkGrid}>
            {included.map((item, index) => (
              <li key={item.id} style={{ animationDelay: `${index * 35}ms` }}>
                <span className={styles.perkIcon}>
                  <Icon name={capabilityIcon(item.id)} />
                </span>
                <span>
                  {item.label}
                  {item.showValue ? <em> · {item.valueLabel}</em> : null}
                </span>
              </li>
            ))}
          </ul>
          {recommendedId !== currentPlanId ? (
            <button
              type="button"
              className={styles.nudge}
              onClick={() => setSelectedId(recommendedId)}
            >
              Ver qué desbloqueo en {getCompanyPlan(recommendedId).name}
              <Icon name="arrow" />
            </button>
          ) : null}
        </section>
      ) : (
        <section
          key={selectedId}
          className={`${styles.compare} ${comparison.direction === 'upgrade' ? styles.compareUp : styles.compareDown}`}
          aria-label="Comparación de plan"
        >
          <div className={styles.compareHero}>
            <p className={styles.compareKicker}>
              {comparison.direction === 'upgrade' ? 'Subida de nivel' : 'Bajada de nivel'}
            </p>
            <h3>
              {comparison.direction === 'upgrade'
                ? selectedStory.hook
                : `Bajar a ${selectedPlan.name} apaga lo que ya te diferencia.`}
            </h3>
            <p>
              {comparison.direction === 'upgrade'
                ? `${formatCompanyPlanPrice(currentPlan)} → ${formatCompanyPlanPrice(selectedPlan)}. ${selectedStory.promise}`
                : `Pasarías de ${formatCompanyPlanPrice(currentPlan)} a ${formatCompanyPlanPrice(selectedPlan)}. Tus clientes notarían el vacío.`}
            </p>
          </div>

          <div className={styles.deltaGrid}>
            {comparison.gained.length > 0 ? (
              <div className={styles.gainCol}>
                <h4>
                  <Icon name="spark" />
                  Se enciende
                </h4>
                <ul>
                  {comparison.gained.map((item, index) => (
                    <li key={item.id} style={{ animationDelay: `${index * 40}ms` }}>
                      <span className={styles.deltaIcon}>
                        <Icon name={capabilityIcon(item.id)} />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <em>
                          {item.fromLabel === 'No incluido'
                            ? `Nuevo · ${item.toLabel}`
                            : `${item.fromLabel} → ${item.toLabel}`}
                        </em>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {comparison.lost.length > 0 ? (
              <div className={styles.loseCol}>
                <h4>
                  <Icon name="lock" />
                  Se apaga
                </h4>
                <ul>
                  {comparison.lost.map((item, index) => (
                    <li key={item.id} style={{ animationDelay: `${index * 40}ms` }}>
                      <span className={styles.deltaIcon}>
                        <Icon name="lock" />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <em>
                          {item.toLabel === 'No incluido'
                            ? 'Desaparece de tu local'
                            : `${item.fromLabel} → ${item.toLabel}`}
                        </em>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

            <button
              type="button"
              className={`${styles.cta} ${comparison.direction === 'downgrade' ? styles.ctaDown : ''}`}
              disabled={requestBusy || hasPending}
              onClick={() => void sendPlanRequest()}
            >
            <span className={styles.ctaShine} aria-hidden="true" />
            <span>{hasPending ? 'Solicitud ya enviada' : requestBusy ? 'Enviando…' : ctaLabel}</span>
            <Icon name="arrow" />
          </button>
          {requestMessage ? <p className={styles.requestNote}>{requestMessage}</p> : null}
          <a className={styles.mailFallback} href={companyPlanChangeMailto(company.name, currentPlan, selectedPlan)}>
            O escríbenos por correo
          </a>
        </section>
      )}
    </div>
  )
}

export default CompanyPlan
