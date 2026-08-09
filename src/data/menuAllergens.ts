export interface MenuAllergenOption {
  id: string
  label: string
  icon: string
}

/** Alérgenos habituales (Reglamento UE 1169/2011) con icono representativo. */
export const MENU_ALLERGEN_OPTIONS: MenuAllergenOption[] = [
  { id: 'Gluten', label: 'Gluten', icon: '🌾' },
  { id: 'Lactosa', label: 'Lactosa', icon: '🥛' },
  { id: 'Huevo', label: 'Huevo', icon: '🥚' },
  { id: 'Frutos secos', label: 'Frutos secos', icon: '🥜' },
  { id: 'Marisco', label: 'Marisco', icon: '🦐' },
  { id: 'Pescado', label: 'Pescado', icon: '🐟' },
  { id: 'Soja', label: 'Soja', icon: '🫘' },
  { id: 'Apio', label: 'Apio', icon: '🥬' },
  { id: 'Mostaza', label: 'Mostaza', icon: '🌭' },
  { id: 'Sésamo', label: 'Sésamo', icon: '🌻' },
  { id: 'Sulfitos', label: 'Sulfitos', icon: '🍷' },
  { id: 'Altramuces', label: 'Altramuces', icon: '🌿' },
  { id: 'Moluscos', label: 'Moluscos', icon: '🦪' },
]

export function getMenuAllergenIcon(allergenId: string): string {
  return MENU_ALLERGEN_OPTIONS.find((option) => option.id === allergenId)?.icon ?? '⚠️'
}

export function getMenuAllergenLabel(allergenId: string): string {
  return MENU_ALLERGEN_OPTIONS.find((option) => option.id === allergenId)?.label ?? allergenId
}

/** @deprecated Usar MENU_ALLERGEN_OPTIONS */
export const COMMON_MENU_ALLERGENS = MENU_ALLERGEN_OPTIONS.map((option) => option.id)
