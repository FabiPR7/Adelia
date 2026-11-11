import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MissionProgress } from '../../types/gamification'

const nudge = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../../hooks/useMissionNudge', () => ({ useMissionNudge: () => nudge.value }))
vi.mock('../MissionIcon', () => ({ default: () => <span>icon</span> }))

import MissionNudgeCard from '../MissionNudgeCard'

const mission = (id: string, current: number, target: number, xp = 60): MissionProgress => ({
  mission: { id, name: 'Mesa con Reserva', description: '', xp, cadence: 'weekly', icon: '📅', target },
  current,
  completed: false,
  progress: current / target,
})

const base = {
  loading: false,
  pendingWeekly: [] as MissionProgress[],
  pendingMonthly: [] as MissionProgress[],
  reservationFed: [] as MissionProgress[],
  bonus: { done: 3, target: 5, xp: 150, earned: false, left: 2 },
  timeLeft: 'Quedan 4 días',
}

const renderCard = (props: { upcomingReservations?: number } = {}) =>
  render(<MemoryRouter><MissionNudgeCard {...props} /></MemoryRouter>)

beforeEach(() => {
  nudge.value = base
})

describe('MissionNudgeCard', () => {
  it('shows the closest mission with what is left, the prize and a button to act', () => {
    const closest = mission('reserva_confirmada_semana', 2, 3)
    nudge.value = { ...base, closest, pendingWeekly: [closest] }
    renderCard()

    expect(screen.getByText('Casi lo tienes')).toBeInTheDocument()
    expect(screen.getByText(/Te falta 1/)).toBeInTheDocument()
    expect(screen.getByText('+60 XP')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reservar mesa' })).toHaveAttribute('href', '/app/explorar')
    expect(screen.getByRole('progressbar', { name: /Mesa con Reserva/ })).toHaveAttribute('aria-valuenow', '67')
  })

  it('shows the weekly chest with how many are missing and the time left', () => {
    const closest = mission('reserva_confirmada_semana', 0, 1)
    nudge.value = { ...base, closest, pendingWeekly: [closest] }
    renderCard()

    expect(screen.getByText(/3\/5 semanales · 2 más para \+150 XP/)).toBeInTheDocument()
    expect(screen.getByText(/Quedan 4 días/)).toBeInTheDocument()
    expect(screen.getByText('Tu próxima misión')).toBeInTheDocument()
  })

  it('tells the diner a reservation will advance a mission', () => {
    const closest = mission('reserva_confirmada_semana', 0, 1)
    nudge.value = { ...base, closest, pendingWeekly: [closest], reservationFed: [closest] }
    renderCard({ upcomingReservations: 1 })

    expect(screen.getByText(/Tu próxima reserva suma a «Mesa con Reserva»/)).toBeInTheDocument()
  })

  it('celebrates a finished week instead of nagging', () => {
    nudge.value = { ...base, closest: null, bonus: { ...base.bonus, earned: true, done: 5, left: 0 } }
    renderCard()

    expect(screen.getByText('Semana completa')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders nothing while loading or when nothing is pending', () => {
    nudge.value = { ...base, loading: true }
    expect(renderCard().container).toBeEmptyDOMElement()

    nudge.value = { ...base, closest: null }
    expect(renderCard().container).toBeEmptyDOMElement()
  })
})
