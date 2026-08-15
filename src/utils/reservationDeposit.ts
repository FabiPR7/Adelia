export function companyRequiresReservationDeposit(
  pax: number,
  company: { depositEnabled?: boolean; depositMinPax?: number | null },
): boolean {
  if (company.depositEnabled === false) {
    return false
  }

  const threshold = company.depositMinPax

  return typeof threshold === 'number' && threshold > 0 && pax >= threshold
}

export function companyCanCollectReservationDeposits(company: {
  stripeChargesEnabled?: boolean
  stripeDetailsSubmitted?: boolean
}): boolean {
  return company.stripeChargesEnabled === true && company.stripeDetailsSubmitted === true
}

export function companyRequiresStripeDeposit(
  pax: number,
  company: {
    depositEnabled?: boolean
    depositMinPax?: number | null
    depositPerGuestCents?: number | null
    stripeChargesEnabled?: boolean
    stripeDetailsSubmitted?: boolean
  },
): boolean {
  if (company.depositEnabled === false) {
    return false
  }

  return companyRequiresReservationDeposit(pax, company)
    && computeReservationDepositCents(pax, company) > 0
    && companyCanCollectReservationDeposits(company)
}

export function computeReservationDepositCents(
  pax: number,
  company: {
    depositMinPax?: number | null
    depositPerGuestCents?: number | null
  },
): number {
  if (!companyRequiresReservationDeposit(pax, company)) {
    return 0
  }

  const perGuest = company.depositPerGuestCents ?? 0

  if (perGuest <= 0) {
    return 0
  }

  return perGuest * pax
}

export function formatDepositPerGuestLabel(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

export function formatDepositAmountLabel(cents: number): string {
  return formatDepositPerGuestLabel(cents)
}

export function reservationHasAuthorizedDeposit(
  reservation: {
    depositStatus?: string | null
    depositAmountCents?: number | null
  },
): boolean {
  return reservation.depositStatus === 'authorized'
    && typeof reservation.depositAmountCents === 'number'
    && reservation.depositAmountCents > 0
}

export function buildDepositCancelConfirmCopy(
  reservation: {
    depositAmountCents?: number | null
    startTime: Date
  },
  depositCancellationHours: number | null | undefined,
): { title: string; message: string } {
  const amount = reservation.depositAmountCents ?? 0
  const amountLabel = formatDepositAmountLabel(amount)
  const willCapture = shouldCaptureDepositOnCancellation(
    reservation.startTime,
    depositCancellationHours,
  )

  if (willCapture) {
    return {
      title: 'Reserva con fianza',
      message: `Esta reserva tiene una fianza de ${amountLabel} autorizada en la tarjeta del cliente. Si la marcas como cancelada, se cobrará esa fianza. ¿Seguro que quieres continuar?`,
    }
  }

  return {
    title: 'Reserva con fianza',
    message: `Esta reserva tiene una fianza de ${amountLabel} autorizada en la tarjeta del cliente. Si la marcas como cancelada ahora, la fianza se liberará y no se cobrará. ¿Seguro que quieres continuar?`,
  }
}

export function buildPublicDepositCancelWarningMessage(
  depositAmountCents: number,
  willChargeDeposit: boolean,
  depositCancellationHours: number | null | undefined,
): string {
  const amountLabel = formatDepositAmountLabel(depositAmountCents)

  if (willChargeDeposit) {
    return `Esta reserva tiene una fianza de ${amountLabel} autorizada en tu tarjeta. Si cancelas ahora, se cobrará esa fianza.`
  }

  const policy = formatDepositCancellationPolicy(depositCancellationHours)
  return policy
    ? `Esta reserva tiene una fianza de ${amountLabel} autorizada en tu tarjeta. Si cancelas ahora, la fianza se liberará y no se cobrará. ${policy}`
    : `Esta reserva tiene una fianza de ${amountLabel} autorizada en tu tarjeta. Si cancelas ahora, la fianza se liberará y no se cobrará.`
}

export function formatDepositAuthorizationSummary(
  pax: number,
  perGuestCents: number,
  cancellationHours: number | null | undefined,
): string {
  const perGuestLabel = formatDepositPerGuestLabel(perGuestCents)
  const guestLabel = pax === 1 ? '1 comensal' : `${pax} comensales`
  const hours = typeof cancellationHours === 'number' && cancellationHours > 0
    ? cancellationHours
    : DEFAULT_DEPOSIT_CANCELLATION_HOURS
  const hoursLabel = hours === 1 ? '1 hora' : `${hours} horas`

  return `Para ${guestLabel} debes asegurar una fianza de ${perGuestLabel} por comensal en tu tarjeta. No la perderás si asistes a la reserva ni si cancelas con al menos ${hoursLabel} de antelación.`
}

export const DEFAULT_DEPOSIT_CANCELLATION_HOURS = 24
export const MAX_DEPOSIT_CANCELLATION_HOURS = 720

export function shouldCaptureDepositOnCancellation(
  reservationStart: Date,
  depositCancellationHours: number | null | undefined,
  cancelledAt: Date = new Date(),
): boolean {
  if (typeof depositCancellationHours !== 'number' || depositCancellationHours <= 0) {
    return true
  }

  const msUntilReservation = reservationStart.getTime() - cancelledAt.getTime()

  if (msUntilReservation <= 0) {
    return true
  }

  const hoursUntilReservation = msUntilReservation / (1000 * 60 * 60)
  return hoursUntilReservation < depositCancellationHours
}

export function formatDepositCancellationPolicy(hours: number | null | undefined): string | null {
  if (typeof hours !== 'number' || hours <= 0) {
    return null
  }

  return `Si cancelas con al menos ${hours} ${hours === 1 ? 'hora' : 'horas'} de antelación, no se cobrará la fianza.`
}
