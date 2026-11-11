import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saves = vi.hoisted(() => ({
  savePlanCatalog: vi.fn().mockResolvedValue(undefined),
  saveInventoryItem: vi.fn().mockResolvedValue(undefined),
  saveRewardsConfig: vi.fn().mockResolvedValue(undefined),
  savePenaltyConfig: vi.fn().mockResolvedValue(undefined),
  saveBillingConfig: vi.fn().mockResolvedValue(undefined),
  saveCompanyGame: vi.fn().mockResolvedValue(undefined),
  saveCustomerGame: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../config/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../../services/adminCatalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/adminCatalog')>()),
  ...saves,
  loadBillingConfig: vi.fn().mockResolvedValue({
    checkoutUrl: 'https://example.test/buy',
    storeId: '1',
    variants: [
      { variantId: '10', plan: 'basic', period: 'monthly' },
      { variantId: '11', plan: 'premium', period: 'monthly' },
    ],
  }),
}))

import AdminCatalogBoard from '../AdminCatalogBoard'

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))
const saveButton = (label = 'Guardar cambios') => screen.getByRole('button', { name: label })

// La tabla de capacidades es grande y bajo carga (suite completa) supera los 5 s por defecto.
vi.setConfig({ testTimeout: 20000 })

beforeEach(() => vi.clearAllMocks())

describe('AdminCatalogBoard', () => {
  it('starts clean and enables saving only after an edit, then saves plans', async () => {
    render(<AdminCatalogBoard />)
    expect(saveButton()).toBeDisabled()

    const price = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(price, { target: { value: '44.5' } })
    expect(saveButton()).toBeEnabled()

    fireEvent.click(saveButton())
    await waitFor(() => expect(saves.savePlanCatalog).toHaveBeenCalledTimes(1))
    const [plans] = saves.savePlanCatalog.mock.calls[0]
    expect(plans.find((plan: { id: string }) => plan.id === 'basic').priceMonthly).toBe(44.5)
    await waitFor(() => expect(screen.getByText(/Guardado/)).toBeInTheDocument())
  })

  it('blocks invalid plan prices with a clear message and does not write', async () => {
    render(<AdminCatalogBoard />)
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } })
    fireEvent.click(saveButton())
    expect(await screen.findByText(/Precio mensual no válido/)).toBeInTheDocument()
    expect(saves.savePlanCatalog).not.toHaveBeenCalled()
  })

  it('edits an item and refuses a new item with a bad id', async () => {
    render(<AdminCatalogBoard />)
    openTab('Ítems')
    fireEvent.change(screen.getByDisplayValue('Sello Blanca'), { target: { value: 'Sello Nuevo' } })
    fireEvent.click(saveButton('Guardar ítem'))
    await waitFor(() => expect(saves.saveInventoryItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'mesa_1', name: 'Sello Nuevo' })))

    fireEvent.click(screen.getByRole('button', { name: /Nuevo ítem/ }))
    fireEvent.change(screen.getByPlaceholderText('sello_oro'), { target: { value: 'Mal Id!' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Algo' } })
    fireEvent.click(saveButton('Crear ítem'))
    expect(await screen.findByText(/minúsculas, números y _/)).toBeInTheDocument()
    expect(saves.saveInventoryItem).toHaveBeenCalledTimes(1)
  })

  it('validates rewards: a loot pool cannot be emptied', async () => {
    render(<AdminCatalogBoard />)
    openTab('Recompensas')
    const group = screen.getByText('Premio sencillo', { selector: 'strong' }).closest('div') as HTMLElement
    for (const chip of within(group).getAllByRole('button', { pressed: true })) {
      fireEvent.click(chip)
    }
    fireEvent.click(saveButton())
    expect(await screen.findByText(/necesita al menos un ítem/)).toBeInTheDocument()
    expect(saves.saveRewardsConfig).not.toHaveBeenCalled()
  })

  it('saves penalties and billing', async () => {
    render(<AdminCatalogBoard />)
    openTab('Penalizaciones')
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '20' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(saves.savePenaltyConfig).toHaveBeenCalledWith(expect.objectContaining({ lockStrikes: 5 })))

    openTab('Cobro')
    const url = await screen.findByDisplayValue('https://example.test/buy')
    fireEvent.change(url, { target: { value: 'http://inseguro.test' } })
    fireEvent.click(saveButton())
    expect(await screen.findByText(/https:\/\//)).toBeInTheDocument()
    fireEvent.change(url, { target: { value: 'https://example.test/live' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(saves.saveBillingConfig).toHaveBeenCalledWith(expect.objectContaining({ checkoutUrl: 'https://example.test/live' })))
  })

  it('rejects level tables that do not grow and saves company game data', async () => {
    render(<AdminCatalogBoard />)
    openTab('Niveles de comensales')
    const minXp = screen.getAllByRole('spinbutton')[1]
    fireEvent.change(minXp, { target: { value: '0' } })
    fireEvent.click(saveButton())
    expect(await screen.findByText(/más XP que el anterior/)).toBeInTheDocument()
    expect(saves.saveCustomerGame).not.toHaveBeenCalled()

    openTab('Gamificación de locales')
    fireEvent.change(screen.getByLabelText('XP por reserva confirmada'), { target: { value: '5' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(saves.saveCompanyGame).toHaveBeenCalledTimes(1))
  })
})
