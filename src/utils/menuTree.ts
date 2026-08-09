import type { MenuNode } from '../types/company'
import { validateMenuCategoryAvailability } from './menuCategoryAvailability'

export interface MenuTreeNode extends MenuNode {
  children: MenuTreeNode[]
  depth: number
}

export function buildMenuTree(nodes: MenuNode[]): MenuTreeNode[] {
  const byParent = new Map<string | null, MenuNode[]>()

  for (const node of nodes) {
    const parentKey = node.parentId
    const siblings = byParent.get(parentKey) ?? []
    siblings.push(node)
    byParent.set(parentKey, siblings)
  }

  const sortSiblings = (items: MenuNode[]) =>
    [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))

  const walk = (parentId: string | null, depth: number): MenuTreeNode[] =>
    sortSiblings(byParent.get(parentId) ?? []).map((node) => ({
      ...node,
      depth,
      children: walk(node.id, depth + 1),
    }))

  return walk(null, 0)
}

export function flattenMenuTree(tree: MenuTreeNode[]): MenuTreeNode[] {
  const result: MenuTreeNode[] = []

  const walk = (nodes: MenuTreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      walk(node.children)
    }
  }

  walk(tree)
  return result
}

export function getSiblingIds(nodes: MenuNode[], nodeId: string): string[] {
  const node = nodes.find((entry) => entry.id === nodeId)
  if (!node) {
    return []
  }

  return nodes
    .filter((entry) => entry.parentId === node.parentId && entry.boardId === node.boardId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => entry.id)
}

export function reorderSiblingIds(siblingIds: string[], dragId: string, targetId: string): string[] {
  if (dragId === targetId) {
    return siblingIds
  }

  const next = siblingIds.filter((id) => id !== dragId)
  const targetIndex = next.indexOf(targetId)

  if (targetIndex === -1) {
    return siblingIds
  }

  next.splice(targetIndex, 0, dragId)
  return next
}

export function applySortOrders(nodes: MenuNode[], orderedIds: string[], parentId: string | null, boardId: string): MenuNode[] {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]))

  return nodes.map((node) => {
    if (node.boardId !== boardId || node.parentId !== parentId) {
      return node
    }

    const order = orderMap.get(node.id)
    return order == null ? node : { ...node, sortOrder: order }
  })
}

export function moveSibling(nodes: MenuNode[], nodeId: string, direction: -1 | 1): MenuNode[] {
  const node = nodes.find((entry) => entry.id === nodeId)
  if (!node) {
    return nodes
  }

  const siblingIds = getSiblingIds(nodes, nodeId)
  const index = siblingIds.indexOf(nodeId)
  const swapIndex = index + direction

  if (index === -1 || swapIndex < 0 || swapIndex >= siblingIds.length) {
    return nodes
  }

  const reordered = [...siblingIds]
  ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]

  return applySortOrders(nodes, reordered, node.parentId, node.boardId)
}

export function collectDescendantIds(nodes: MenuNode[], rootId: string): string[] {
  const ids = new Set<string>([rootId])
  let changed = true

  while (changed) {
    changed = false
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id)
        changed = true
      }
    }
  }

  return [...ids]
}

export function validateMenuNodeInput(input: {
  name: string
  nodeType: MenuNode['nodeType']
  priceCents?: number | null
  availability?: MenuNode['availability']
}): string | null {
  if (!input.name.trim()) {
    return 'Indica un nombre.'
  }

  if (input.nodeType === 'product' && input.priceCents != null && input.priceCents < 0) {
    return 'El precio no puede ser negativo.'
  }

  if (input.nodeType === 'family' && input.availability) {
    return validateMenuCategoryAvailability(input.availability, input.name)
  }

  return null
}

export type MenuDropPosition = 'before' | 'after' | 'inside' | 'root'

export function isDescendant(nodes: MenuNode[], ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) {
    return true
  }

  return collectDescendantIds(nodes, ancestorId).includes(nodeId)
}

export function getNodePathLabel(
  node: Pick<MenuNode, 'parentId' | 'nodeType'>,
  nodes: MenuNode[],
): string | null {
  if (!node.parentId) {
    return null
  }

  const parts: string[] = []
  let currentId: string | null = node.parentId

  while (currentId) {
    const parent = nodes.find((entry) => entry.id === currentId)
    if (!parent) {
      break
    }

    parts.unshift(parent.name)
    currentId = parent.parentId
  }

  if (parts.length === 0) {
    return null
  }

  return node.nodeType === 'product' ? `En ${parts.join(' › ')}` : parts.join(' › ')
}

function countSiblings(
  nodes: MenuNode[],
  boardId: string,
  parentId: string | null,
  excludeId?: string,
): number {
  return nodes.filter(
    (entry) =>
      entry.boardId === boardId
      && entry.parentId === parentId
      && entry.id !== excludeId,
  ).length
}

function normalizeSiblingOrders(
  nodes: MenuNode[],
  boardId: string,
  parentId: string | null,
): MenuNode[] {
  const orderedIds = nodes
    .filter((entry) => entry.boardId === boardId && entry.parentId === parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((entry) => entry.id)

  return applySortOrders(nodes, orderedIds, parentId, boardId)
}

export function canDropNode(
  nodes: MenuNode[],
  dragId: string,
  targetId: string | null,
  position: MenuDropPosition,
): boolean {
  const dragged = nodes.find((entry) => entry.id === dragId)
  if (!dragged) {
    return false
  }

  if (position === 'root') {
    return dragged.parentId !== null
  }

  if (!targetId || dragId === targetId) {
    return false
  }

  const target = nodes.find((entry) => entry.id === targetId)
  if (!target || target.boardId !== dragged.boardId) {
    return false
  }

  if (dragged.nodeType === 'family' && isDescendant(nodes, dragId, targetId)) {
    return false
  }

  if (position === 'inside') {
    if (target.nodeType !== 'family') {
      return false
    }

    if (dragged.parentId === target.id) {
      return false
    }

    return true
  }

  if (dragged.nodeType === 'family' && target.parentId && isDescendant(nodes, dragId, target.parentId)) {
    return false
  }

  return true
}

export function resolveDropPosition(
  clientY: number,
  rowTop: number,
  rowHeight: number,
  targetIsFamily: boolean,
): MenuDropPosition {
  const offset = clientY - rowTop
  const ratio = rowHeight > 0 ? offset / rowHeight : 0.5

  if (targetIsFamily && ratio >= 0.3 && ratio <= 0.7) {
    return 'inside'
  }

  return ratio < 0.5 ? 'before' : 'after'
}

export function moveNode(
  nodes: MenuNode[],
  dragId: string,
  targetId: string | null,
  position: MenuDropPosition,
): MenuNode[] {
  const dragged = nodes.find((entry) => entry.id === dragId)
  if (!dragged || !canDropNode(nodes, dragId, targetId, position)) {
    return nodes
  }

  const boardId = dragged.boardId
  const oldParentId = dragged.parentId
  let next = nodes.map((entry) => ({ ...entry }))

  const patchDragged = (parentId: string | null, sortOrder: number) => {
    next = next.map((entry) =>
      entry.id === dragId ? { ...entry, parentId, sortOrder } : entry,
    )
  }

  if (position === 'root') {
    patchDragged(null, countSiblings(next, boardId, null, dragId))
    next = normalizeSiblingOrders(next, boardId, null)
    if (oldParentId !== null) {
      next = normalizeSiblingOrders(next, boardId, oldParentId)
    }
    return next
  }

  const target = next.find((entry) => entry.id === targetId)
  if (!target) {
    return nodes
  }

  if (position === 'inside') {
    patchDragged(target.id, countSiblings(next, boardId, target.id, dragId))
    next = normalizeSiblingOrders(next, boardId, target.id)
    if (oldParentId !== target.id) {
      next = normalizeSiblingOrders(next, boardId, oldParentId)
    }
    return next
  }

  const newParentId = target.parentId
  patchDragged(newParentId, target.sortOrder)

  const siblingIds = next
    .filter(
      (entry) =>
        entry.boardId === boardId && entry.parentId === newParentId && entry.id !== dragId,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((entry) => entry.id)

  const targetIndex = siblingIds.indexOf(target.id)
  const insertAt = position === 'before' ? Math.max(0, targetIndex) : targetIndex + 1
  siblingIds.splice(insertAt, 0, dragId)

  next = applySortOrders(next, siblingIds, newParentId, boardId)
  if (oldParentId !== newParentId) {
    next = normalizeSiblingOrders(next, boardId, oldParentId)
  }

  return next
}

export function moveNodeToRoot(nodes: MenuNode[], dragId: string): MenuNode[] {
  return moveNode(nodes, dragId, null, 'root')
}

export function getParentFamilyName(
  node: Pick<MenuNode, 'parentId'>,
  nodes: MenuNode[],
): string | null {
  if (!node.parentId) {
    return null
  }

  const parent = nodes.find((entry) => entry.id === node.parentId)
  return parent?.nodeType === 'family' ? parent.name : null
}

export function getFamilyTypeLabel(
  node: Pick<MenuNode, 'nodeType' | 'parentId'>,
  nodes: MenuNode[],
): string {
  if (node.nodeType !== 'family') {
    return 'Producto'
  }

  const parentName = getParentFamilyName(node, nodes)
  return parentName ? `Subfamilia de ${parentName}` : 'Familia'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getProductCopyName(sourceName: string, existingNames: string[]): string {
  const trimmed = sourceName.trim()
  const numberedMatch = trimmed.match(/^(.+?)\s+(\d+)$/)
  const base = numberedMatch ? numberedMatch[1].trim() : trimmed

  if (!base) {
    return trimmed
  }

  const exactPattern = new RegExp(`^${escapeRegExp(base)}$`, 'i')
  const numberedPattern = new RegExp(`^${escapeRegExp(base)}\\s+(\\d+)$`, 'i')
  let maxNumber = 0

  for (const name of existingNames) {
    const candidate = name.trim()
    if (exactPattern.test(candidate)) {
      maxNumber = Math.max(maxNumber, 1)
      continue
    }

    const match = candidate.match(numberedPattern)
    if (match) {
      maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10))
    }
  }

  return `${base} ${maxNumber + 1}`
}

export function sanitizeMenuPriceInput(value: string): string {
  let result = ''
  let separatorUsed = false

  for (const char of value) {
    if (char >= '0' && char <= '9') {
      result += char
      continue
    }

    if ((char === ',' || char === '.') && !separatorUsed) {
      result += ','
      separatorUsed = true
    }
  }

  const commaIndex = result.indexOf(',')

  if (commaIndex === -1) {
    return result
  }

  const integerPart = result.slice(0, commaIndex)
  const decimalPart = result.slice(commaIndex + 1).replace(/,/g, '').slice(0, 2)
  return `${integerPart},${decimalPart}`
}

export function formatMenuPrice(
  priceCents: number | null | undefined,
  currency = 'EUR',
  locale = 'es-ES',
): string {
  if (priceCents == null) {
    return ''
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(priceCents / 100)
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency}`
  }
}

export function parseMenuPriceInput(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100)
}
