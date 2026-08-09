export interface MenuCurrencyOption {
  code: string
  label: string
  symbol: string
}

export const DEFAULT_MENU_CURRENCY = 'EUR'

export const MENU_CURRENCY_OPTIONS: MenuCurrencyOption[] = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'Dólar USA', symbol: '$' },
  { code: 'GBP', label: 'Libra esterlina', symbol: '£' },
  { code: 'CHF', label: 'Franco suizo', symbol: 'CHF' },
  { code: 'MXN', label: 'Peso mexicano', symbol: '$' },
  { code: 'ARS', label: 'Peso argentino', symbol: '$' },
  { code: 'COP', label: 'Peso colombiano', symbol: '$' },
  { code: 'CLP', label: 'Peso chileno', symbol: '$' },
  { code: 'JPY', label: 'Yen japonés', symbol: '¥' },
]

export function getMenuCurrencyOption(code: string | undefined): MenuCurrencyOption {
  return MENU_CURRENCY_OPTIONS.find((option) => option.code === code) ?? MENU_CURRENCY_OPTIONS[0]
}
