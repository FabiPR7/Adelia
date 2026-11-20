/**
 * Tipos de comida para «¿Qué te apetece?»: cada botón agrupa varias características
 * que el restaurante marca en sus ajustes (por ejemplo, «Pinchos» incluye «Pincho pote»
 * y «Tapas»). Las `main` salen también en el filtro del buscador.
 */
export interface FoodCategory {
  id: string
  label: string
  emoji: string
  /** Características del local (COMPANY_CHARACTERISTIC_OPTIONS) que cuentan para este tipo. */
  matches: readonly string[]
  /** Sale en el filtro del buscador. */
  main?: boolean
}

export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  { id: 'hamburguesas', label: 'Hamburguesas', emoji: '🍔', matches: ['Hamburguesas', 'Hamburguesería', 'Smash burger', 'Americana'], main: true },
  { id: 'pizzas', label: 'Pizzas', emoji: '🍕', matches: ['Pizza', 'Pizzería'], main: true },
  { id: 'pinchos', label: 'Pinchos', emoji: '🍢', matches: ['Pinchos', 'Pincho pote', 'Tapas', 'Raciones', 'Croquetas'], main: true },
  { id: 'pincho-pote', label: 'Pincho pote', emoji: '🥂', matches: ['Pincho pote'], main: true },
  { id: 'vinos', label: 'Vinos', emoji: '🍷', matches: ['Vinos', 'Bodega', 'Enoteca', 'Vermut'], main: true },
  { id: 'woks', label: 'Woks', emoji: '🥡', matches: ['Wok'], main: true },
  { id: 'buffets', label: 'Buffets', emoji: '🍽️', matches: ['Buffet', 'Buffet libre'], main: true },
  { id: 'sushi', label: 'Sushi', emoji: '🍣', matches: ['Sushi', 'Comida japonesa', 'Poke', 'Ramen'], main: true },
  { id: 'asiatica', label: 'Asiática', emoji: '🥢', matches: ['Comida asiática', 'Comida china', 'Comida coreana', 'Comida tailandesa', 'Comida vietnamita', 'Dim sum', 'Wok', 'Ramen'] },
  { id: 'carnes', label: 'Carnes y brasas', emoji: '🥩', matches: ['Carnes', 'Parrilla', 'Brasas', 'Asador', 'Chuletón', 'Steakhouse', 'Solomillo', 'Argentino'], main: true },
  { id: 'mariscos', label: 'Marisco y pescado', emoji: '🦐', matches: ['Mariscos', 'Marisquería', 'Pescado'] },
  { id: 'arroces', label: 'Arroces', emoji: '🥘', matches: ['Paella', 'Arroces'] },
  { id: 'italiana', label: 'Italiana', emoji: '🍝', matches: ['Italiana', 'Pasta', 'Pizza'] },
  { id: 'mexicana', label: 'Mexicana', emoji: '🌮', matches: ['Mexicana', 'Tex-Mex', 'Tacos'] },
  { id: 'kebab', label: 'Kebab y árabe', emoji: '🥙', matches: ['Kebab', 'Shawarma', 'Falafel', 'Turca', 'Árabe', 'Libanesa'] },
  { id: 'india', label: 'India', emoji: '🍛', matches: ['Comida india'] },
  { id: 'bocadillos', label: 'Bocatas y rápida', emoji: '🥪', matches: ['Bocadillos', 'Comida rápida', 'Street food', 'Hot dogs'] },
  { id: 'pollo', label: 'Pollo y alitas', emoji: '🍗', matches: ['Pollo asado', 'Alitas'] },
  { id: 'brunch', label: 'Brunch y desayunos', emoji: '🥞', matches: ['Brunch', 'Desayunos', 'Meriendas', 'Cafetería'], main: true },
  { id: 'menu-del-dia', label: 'Menú del día', emoji: '🍲', matches: ['Menú del día', 'Cocina casera', 'Guisos'], main: true },
  { id: 'tradicional', label: 'Cocina de aquí', emoji: '🍇', matches: ['Riojana', 'Española', 'Vasca', 'Gallega', 'Andaluza', 'Cocina de mercado', 'Producto local', 'Km 0', 'Taberna', 'Cachopo', 'Tortilla'] },
  { id: 'saludable', label: 'Sano y veggie', emoji: '🥗', matches: ['Saludable', 'Vegetariano', 'Vegano', 'Sin gluten', 'Keto', 'Orgánico', 'Poke'] },
  { id: 'postres', label: 'Dulces y postres', emoji: '🍰', matches: ['Postres', 'Repostería', 'Heladería', 'Chocolatería', 'Churros', 'Gofres', 'Crepes'] },
  { id: 'copas', label: 'Copas y cócteles', emoji: '🍸', matches: ['Coctelería', 'Gastrobar', 'Afterwork', 'Late night'] },
  { id: 'cerveza', label: 'Cerveza y sidra', emoji: '🍺', matches: ['Cerveza artesanal', 'Sidra'] },
  { id: 'alta-cocina', label: 'Alta cocina', emoji: '⭐', matches: ['Estrella Michelin', 'Alta cocina', 'Gastronómico', 'Fine dining', 'Menú degustación', 'Carta de autor'] },
]

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export function findFoodCategory(idOrLabel: string): FoodCategory | null {
  const wanted = normalize(idOrLabel)
  if (!wanted) return null
  return FOOD_CATEGORIES.find((category) => category.id === wanted || normalize(category.label) === wanted) ?? null
}

/** El restaurante tiene alguna característica de este tipo de comida. */
export function restaurantMatchesFoodCategory(
  restaurant: { characteristics: readonly string[] },
  category: FoodCategory,
): boolean {
  const wanted = new Set(category.matches.map(normalize))
  return restaurant.characteristics.some((characteristic) => wanted.has(normalize(characteristic)))
}

export const MAIN_FOOD_CATEGORIES = FOOD_CATEGORIES.filter((category) => category.main)
