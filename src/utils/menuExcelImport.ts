import * as XLSX from 'xlsx'
import { MENU_ALLERGEN_OPTIONS } from '../data/menuAllergens'
import type { MenuAllergenOption } from '../data/menuAllergens'
import type { MenuNode, MenuNodeInput } from '../types/company'
import { generateUuid } from './helpers'
import { buildMenuTree, flattenMenuTree, type MenuTreeNode } from './menuTree'
import { parseMenuPriceInput } from './menuTree'

export const MENU_EXCEL_BASE_HEADERS = ['familia', 'nombre', 'descripcion', 'precio'] as const

export function getAllergenExcelHeader(option: MenuAllergenOption): string {
  return option.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function getMenuExcelAllergenHeaders(): string[] {
  return MENU_ALLERGEN_OPTIONS.map(getAllergenExcelHeader)
}

export function getMenuExcelHeaders(): string[] {
  return [...MENU_EXCEL_BASE_HEADERS, ...getMenuExcelAllergenHeaders()]
}

export interface MenuExcelExportRow {
  familia: string
  nombre: string
  descripcion: string
  precio: string
  allergenFlags: Record<string, 'si' | 'no'>
}

export interface MenuExcelExportGroup {
  id: string
  label: string
  productIds: string[]
  productCount: number
}

export interface MenuExcelRow {
  rowNumber: number
  family: string
  name: string
  description: string
  priceInput: string
  priceCents: number | null
  allergens: string[]
  warnings: string[]
}

export interface MenuExcelParseResult {
  rows: MenuExcelRow[]
  validRows: MenuExcelRow[]
  errors: string[]
}

export interface MenuNodeImportInput extends MenuNodeInput {
  id: string
}

const HEADER_ALIASES: Record<'family' | 'name' | 'description' | 'priceInput', string[]> = {
  family: ['familia', 'family', 'categoria', 'categoría', 'seccion', 'sección'],
  name: ['nombre', 'name', 'producto', 'plato'],
  description: ['descripcion', 'descripción', 'description', 'desc'],
  priceInput: ['precio', 'price', 'importe', 'pvp'],
}

const LEGACY_ALLERGEN_ALIASES = ['alergenos', 'alérgenos', 'allergens', 'alergia', 'alergias']
const LEGACY_HAS_ALLERGEN_ALIASES = [
  'tiene_alergenos',
  'tiene alergenos',
  'tiene alérgenos',
  'si_no',
  'sí/no',
  'sino',
  'alergenos_si_no',
]

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeCell(value: unknown): string {
  if (value == null) {
    return ''
  }

  return String(value).trim()
}

function resolveBaseColumnIndexes(headers: string[]): Record<keyof typeof HEADER_ALIASES, number | null> {
  const indexes: Record<keyof typeof HEADER_ALIASES, number | null> = {
    family: null,
    name: null,
    description: null,
    priceInput: null,
  }

  headers.forEach((header, index) => {
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
      [keyof typeof HEADER_ALIASES, string[]]
    >) {
      if (indexes[field] != null) {
        continue
      }

      if (aliases.includes(header)) {
        indexes[field] = index
      }
    }
  })

  return indexes
}

function resolveAllergenColumnIndexes(headers: string[]): Map<string, number> {
  const indexes = new Map<string, number>()

  headers.forEach((header, index) => {
    for (const option of MENU_ALLERGEN_OPTIONS) {
      if (indexes.has(option.id)) {
        continue
      }

      const candidates = new Set([
        normalizeHeader(getAllergenExcelHeader(option)),
        normalizeHeader(option.id),
        normalizeHeader(option.label),
      ])

      if (candidates.has(header)) {
        indexes.set(option.id, index)
      }
    }
  })

  return indexes
}

function findLegacyColumnIndex(headers: string[], aliases: string[]): number | null {
  const match = headers.findIndex((header) => aliases.includes(header))
  return match === -1 ? null : match
}

function parsePriceCell(value: string): number | null {
  if (!value.trim()) {
    return null
  }

  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)

  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed * 100)
  }

  return parseMenuPriceInput(value.replace('.', ','))
}

function parseYesNoCell(value: string): boolean | null {
  const lower = value.trim().toLowerCase()

  if (!lower || ['no', 'n', '-', '0'].includes(lower)) {
    return false
  }

  if (['si', 'sí', 's', 'yes', 'y', '1', 'x'].includes(lower)) {
    return true
  }

  return null
}

function matchAllergenToken(token: string): string | null {
  const normalized = token.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const exact = MENU_ALLERGEN_OPTIONS.find(
    (option) => option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized,
  )
  if (exact) {
    return exact.id
  }

  const partial = MENU_ALLERGEN_OPTIONS.find(
    (option) =>
      option.label.toLowerCase().includes(normalized)
      || normalized.includes(option.label.toLowerCase()),
  )

  return partial?.id ?? null
}

function parseLegacyAllergensCell(rawValue: string): { allergens: string[]; warnings: string[] } {
  const warnings: string[] = []
  const trimmed = rawValue.trim()

  if (!trimmed) {
    return { allergens: [], warnings }
  }

  const lower = trimmed.toLowerCase()
  if (['no', 'n', '-', 'ninguno', 'ninguna', 'sin alergenos', 'sin alérgenos'].includes(lower)) {
    return { allergens: [], warnings }
  }

  let allergenPart = trimmed

  if (/^(si|sí|yes|s)\b/i.test(trimmed)) {
    const afterYes = trimmed.replace(/^(si|sí|yes|s)\s*[:;,.\-]?\s*/i, '').trim()
    if (!afterYes) {
      warnings.push('Indica los alérgenos separados por coma o escribe «no».')
      return { allergens: [], warnings }
    }

    allergenPart = afterYes
  }

  const tokens = allergenPart
    .split(/[,;|/]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const allergens: string[] = []

  for (const token of tokens) {
    const matched = matchAllergenToken(token)
    if (matched) {
      if (!allergens.includes(matched)) {
        allergens.push(matched)
      }
      continue
    }

    warnings.push(`Alérgeno no reconocido: «${token}»`)
  }

  return { allergens, warnings }
}

function parseAllergensFromRow(
  row: (string | number | null)[],
  allergenColumns: Map<string, number>,
  legacyAllergensRaw: string,
  legacyHasAllergensRaw: string,
): { allergens: string[]; warnings: string[] } {
  if (allergenColumns.size > 0) {
    const allergens: string[] = []
    const warnings: string[] = []

    for (const option of MENU_ALLERGEN_OPTIONS) {
      const columnIndex = allergenColumns.get(option.id)
      if (columnIndex == null) {
        continue
      }

      const cell = normalizeCell(row[columnIndex])
      const yesNo = parseYesNoCell(cell)

      if (yesNo === true) {
        allergens.push(option.id)
        continue
      }

      if (yesNo === null && cell) {
        warnings.push(`«${getAllergenExcelHeader(option)}»: usa si o no (valor «${cell}»).`)
      }
    }

    return { allergens, warnings }
  }

  const parsed = parseLegacyAllergensCell(legacyAllergensRaw)
  const flag = legacyHasAllergensRaw.trim().toLowerCase()

  if (!flag) {
    return parsed
  }

  if (['no', 'n', '-', 'ninguno', 'ninguna'].includes(flag)) {
    return { allergens: [], warnings: parsed.warnings }
  }

  if (['si', 'sí', 's', 'yes', 'y'].includes(flag)) {
    if (parsed.allergens.length === 0 && !legacyAllergensRaw.trim()) {
      return {
        allergens: [],
        warnings: [...parsed.warnings, 'Marcado «sí» en tiene_alergenos pero falta la lista en alergenos.'],
      }
    }

    return parsed
  }

  return parsed
}

function rowHasAnyValue(
  row: (string | number | null)[],
  indexes: Array<number | null>,
): boolean {
  return indexes.some((index) => index != null && normalizeCell(row[index]) !== '')
}

function splitFamilyPath(family: string): string[] {
  return family
    .split(/>|\||\//)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function parseMenuExcelBuffer(buffer: ArrayBuffer): MenuExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    return { rows: [], validRows: [], errors: ['El archivo no contiene hojas.'] }
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  if (matrix.length === 0) {
    return { rows: [], validRows: [], errors: ['La hoja está vacía.'] }
  }

  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => {
      const header = normalizeHeader(cell)
      return HEADER_ALIASES.name.some((alias) => alias === header)
    }),
  )

  if (headerRowIndex === -1) {
    return {
      rows: [],
      validRows: [],
      errors: ['No se encontró la columna «nombre». Usa la primera fila como cabecera.'],
    }
  }

  const headers = matrix[headerRowIndex].map(normalizeHeader)
  const columns = resolveBaseColumnIndexes(headers)
  const allergenColumns = resolveAllergenColumnIndexes(headers)
  const legacyAllergensColumn = findLegacyColumnIndex(headers, LEGACY_ALLERGEN_ALIASES)
  const legacyHasAllergensColumn = findLegacyColumnIndex(headers, LEGACY_HAS_ALLERGEN_ALIASES)

  if (columns.name == null) {
    return {
      rows: [],
      validRows: [],
      errors: ['Falta la columna obligatoria «nombre».'],
    }
  }

  const rows: MenuExcelRow[] = []
  const errors: string[] = []

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? []
    const getCell = (column: number | null) => (column == null ? '' : normalizeCell(row[column]))

    const name = getCell(columns.name)
    const family = getCell(columns.family)
    const description = getCell(columns.description)
    const priceInput = getCell(columns.priceInput)
    const legacyAllergensRaw = getCell(legacyAllergensColumn)
    const legacyHasAllergensRaw = getCell(legacyHasAllergensColumn)

    const allergenIndexes = [...allergenColumns.values()]
    const hasContent = rowHasAnyValue(row, [
      columns.family,
      columns.name,
      columns.description,
      columns.priceInput,
      legacyAllergensColumn,
      legacyHasAllergensColumn,
      ...allergenIndexes,
    ])

    if (!hasContent) {
      continue
    }

    const rowNumber = index + 1
    const warnings: string[] = []

    if (!name) {
      errors.push(`Fila ${rowNumber}: falta el nombre del producto.`)
      continue
    }

    const priceCents = parsePriceCell(priceInput)
    if (priceInput && priceCents == null) {
      warnings.push(`Precio no válido: «${priceInput}»`)
    }

    const { allergens, warnings: allergenWarnings } = parseAllergensFromRow(
      row,
      allergenColumns,
      legacyAllergensRaw,
      legacyHasAllergensRaw,
    )
    warnings.push(...allergenWarnings)

    rows.push({
      rowNumber,
      family,
      name,
      description,
      priceInput,
      priceCents,
      allergens,
      warnings,
    })
  }

  return {
    rows,
    validRows: rows,
    errors,
  }
}

export async function readMenuExcelFile(file: File): Promise<MenuExcelParseResult> {
  const buffer = await file.arrayBuffer()
  return parseMenuExcelBuffer(buffer)
}

function findExistingFamilyId(
  existingNodes: MenuNode[],
  createdFamilies: Map<string, string>,
  pathKey: string,
): string | null {
  if (createdFamilies.has(pathKey)) {
    return createdFamilies.get(pathKey) ?? null
  }

  const segments = pathKey.split('>')

  let parentId: string | null = null
  let currentPath = ''

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}>${segment}` : segment

    if (createdFamilies.has(currentPath)) {
      parentId = createdFamilies.get(currentPath) ?? null
      continue
    }

    const existing = existingNodes.find(
      (node) =>
        node.nodeType === 'family'
        && node.parentId === parentId
        && node.name.localeCompare(segment, 'es', { sensitivity: 'accent' }) === 0,
    )

    if (!existing) {
      return null
    }

    parentId = existing.id
    createdFamilies.set(currentPath, existing.id)
  }

  return parentId
}

function nextSortOrder(
  counters: Map<string, number>,
  parentKey: string,
  existingNodes: Array<Pick<MenuNode, 'boardId' | 'parentId' | 'sortOrder'>>,
  boardId: string,
  parentId: string | null,
): number {
  if (!counters.has(parentKey)) {
    const maxExisting = existingNodes
      .filter((node) => node.boardId === boardId && node.parentId === parentId)
      .reduce((max, node) => Math.max(max, node.sortOrder), -1)

    counters.set(parentKey, maxExisting + 1)
  }

  const order = counters.get(parentKey) ?? 0
  counters.set(parentKey, order + 1)
  return order
}

export function buildMenuImportNodes(
  rows: MenuExcelRow[],
  boardId: string,
  existingNodes: MenuNode[] = [],
  priceCurrency = 'EUR',
): MenuNodeImportInput[] {
  const nodes: MenuNodeImportInput[] = []
  const createdFamilies = new Map<string, string>()
  const sortCounters = new Map<string, number>()

  for (const row of rows) {
    let parentId: string | null = null

    if (row.family.trim()) {
      const segments = splitFamilyPath(row.family)
      let pathKey = ''

      for (const segment of segments) {
        pathKey = pathKey ? `${pathKey}>${segment}` : segment

        const existingId = findExistingFamilyId(existingNodes, createdFamilies, pathKey)
        if (existingId) {
          parentId = existingId
          continue
        }

        if (createdFamilies.has(pathKey)) {
          parentId = createdFamilies.get(pathKey) ?? null
          continue
        }

        const familyParentKey = parentId ?? 'root'
        const familyId = generateUuid()
        const familySortOrder = nextSortOrder(
          sortCounters,
          `family:${familyParentKey}`,
          [...existingNodes, ...nodes],
          boardId,
          parentId,
        )

        nodes.push({
          id: familyId,
          boardId,
          nodeType: 'family',
          parentId,
          sortOrder: familySortOrder,
          name: segment,
          description: '',
          allergens: [],
          priceCents: null,
          priceCurrency,
          photoUrl: '',
          active: true,
          availability: { enabled: false, start: '13:00', end: '16:00' },
        })

        createdFamilies.set(pathKey, familyId)
        parentId = familyId
      }
    }

    const productParentKey = parentId ?? 'root'
    const productSortOrder = nextSortOrder(
      sortCounters,
      `product:${productParentKey}`,
      [...existingNodes, ...nodes],
      boardId,
      parentId,
    )

    nodes.push({
      id: generateUuid(),
      boardId,
      nodeType: 'product',
      parentId,
      sortOrder: productSortOrder,
      name: row.name.trim(),
      description: row.description.trim(),
      allergens: row.allergens,
      priceCents: row.priceCents,
      priceCurrency,
      photoUrl: '',
      active: true,
      availability: { enabled: false, start: '', end: '' },
    })
  }

  return nodes
}

function createEmptyAllergenFlags(): Record<string, 'si' | 'no'> {
  return Object.fromEntries(
    MENU_ALLERGEN_OPTIONS.map((option) => [option.id, 'no']),
  ) as Record<string, 'si' | 'no'>
}

function getProductFamilyPath(product: MenuNode, nodes: MenuNode[]): string {
  if (!product.parentId) {
    return ''
  }

  const parts: string[] = []
  let currentId: string | null = product.parentId

  while (currentId) {
    const parent = nodes.find((entry) => entry.id === currentId)
    if (!parent || parent.nodeType !== 'family') {
      break
    }

    parts.unshift(parent.name)
    currentId = parent.parentId
  }

  return parts.join(' > ')
}

function formatExportPrice(priceCents: number | null | undefined): string {
  if (priceCents == null) {
    return ''
  }

  return (priceCents / 100).toFixed(2).replace('.', ',')
}

export function productToMenuExcelExportRow(product: MenuNode, nodes: MenuNode[]): MenuExcelExportRow {
  const allergenFlags = createEmptyAllergenFlags()

  for (const allergen of product.allergens) {
    if (allergenFlags[allergen] != null) {
      allergenFlags[allergen] = 'si'
    }
  }

  return {
    familia: getProductFamilyPath(product, nodes),
    nombre: product.name,
    descripcion: product.description,
    precio: formatExportPrice(product.priceCents),
    allergenFlags,
  }
}

export function getMenuExcelExportGroups(nodes: MenuNode[]): MenuExcelExportGroup[] {
  const tree = buildMenuTree(nodes)
  const groups: MenuExcelExportGroup[] = []

  const rootProducts = tree.filter((node) => node.nodeType === 'product')
  if (rootProducts.length > 0) {
    groups.push({
      id: '__root__',
      label: 'Productos sueltos',
      productIds: rootProducts.map((node) => node.id),
      productCount: rootProducts.length,
    })
  }

  for (const node of tree) {
    if (node.nodeType !== 'family') {
      continue
    }

    const products = flattenMenuTree(node.children).filter((entry) => entry.nodeType === 'product')
    if (products.length === 0) {
      continue
    }

    groups.push({
      id: node.id,
      label: node.name,
      productIds: products.map((entry) => entry.id),
      productCount: products.length,
    })
  }

  return groups
}

export function buildMenuExcelExportRows(
  nodes: MenuNode[],
  selectedProductIds: Set<string>,
): MenuExcelExportRow[] {
  const tree = buildMenuTree(nodes)
  const rows: MenuExcelExportRow[] = []

  const walk = (treeNodes: MenuTreeNode[]) => {
    for (const node of treeNodes) {
      if (node.nodeType === 'product' && selectedProductIds.has(node.id)) {
        rows.push(productToMenuExcelExportRow(node, nodes))
      }

      if (node.children.length > 0) {
        walk(node.children)
      }
    }
  }

  walk(tree)
  return rows
}

export function getMenuExcelTemplateRows(): MenuExcelExportRow[] {
  const croquetasFlags = createEmptyAllergenFlags()
  croquetasFlags.Gluten = 'si'
  croquetasFlags.Lactosa = 'si'

  return [
    {
      familia: 'Entrantes',
      nombre: 'Croquetas',
      descripcion: 'Caseras',
      precio: '8,50',
      allergenFlags: croquetasFlags,
    },
    {
      familia: 'Carnes > Vacuno',
      nombre: 'Entrecot',
      descripcion: '300 g',
      precio: '24,00',
      allergenFlags: createEmptyAllergenFlags(),
    },
    {
      familia: '',
      nombre: 'Tarta del día',
      descripcion: '',
      precio: '6,00',
      allergenFlags: createEmptyAllergenFlags(),
    },
  ]
}

function exportRowsToMatrix(rows: MenuExcelExportRow[]): string[][] {
  const headers = getMenuExcelHeaders()

  return [
    headers,
    ...rows.map((row) => [
      row.familia,
      row.nombre,
      row.descripcion,
      row.precio,
      ...MENU_ALLERGEN_OPTIONS.map((option) => row.allergenFlags[option.id] ?? 'no'),
    ]),
  ]
}

function buildHelpSheetRows(): string[][] {
  const rows: string[][] = [
    ['Columna', 'Descripción'],
    ['familia', 'Opcional. Vacío = producto suelto. Usa «Carnes > Vacuno» para subfamilias.'],
    ['nombre', 'Obligatorio.'],
    ['descripcion', 'Opcional.'],
    ['precio', 'Opcional. Ejemplo: 12,50'],
    ['', ''],
    ['Alérgenos', 'Cada alérgeno tiene su columna. Escribe si o no en cada una.'],
  ]

  for (const option of MENU_ALLERGEN_OPTIONS) {
    rows.push([getAllergenExcelHeader(option), `si o no — ${option.label}`])
  }

  return rows
}

export function downloadMenuExcelFile(
  fileName: string,
  rows: MenuExcelExportRow[],
  options: { includeHelpSheet?: boolean } = {},
): void {
  const workbook = XLSX.utils.book_new()
  const cartaSheet = XLSX.utils.aoa_to_sheet(exportRowsToMatrix(rows))
  cartaSheet['!cols'] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 34 },
    { wch: 10 },
    ...MENU_ALLERGEN_OPTIONS.map(() => ({ wch: 12 })),
  ]
  XLSX.utils.book_append_sheet(workbook, cartaSheet, 'Carta')

  if (options.includeHelpSheet !== false) {
    const helpSheet = XLSX.utils.aoa_to_sheet(buildHelpSheetRows())
    helpSheet['!cols'] = [{ wch: 18 }, { wch: 72 }]
    XLSX.utils.book_append_sheet(workbook, helpSheet, 'Ayuda')
  }

  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

export function sanitizeMenuExcelFileName(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'carta'
}
