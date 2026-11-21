import {
  collection,
  getDocs,
  limit,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { normalizeMenuTemplate } from '../utils/menuSerialize'
import { callCompanyApi } from './companyApi'
import { db } from '../config/firebase'
import { COMPANY_MENU_BOARD_LIMIT } from './firestoreQuery'
import { normalizeMenuCategoryAvailability } from '../utils/menuCategoryAvailability'
import type {
  MenuBoard,
  MenuBoardInput,
  MenuNode,
  MenuNodeInput,
} from '../types/company'
import {
  getDemoMenuBoards,
  getDemoMenuNodes,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'

const mapTemplate = normalizeMenuTemplate

function mapBoard(id: string, companyId: string, data: Record<string, unknown>): MenuBoard {
  return {
    id,
    companyId,
    name: (data.name as string) ?? '',
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    template: mapTemplate((data.template as Record<string, unknown>) ?? {}),
    pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : '',
    pdfFileName: typeof data.pdfFileName === 'string' ? data.pdfFileName : '',
    pdfPages: typeof data.pdfPages === 'number' && data.pdfPages > 0 ? data.pdfPages : 0,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
  }
}

function mapNode(id: string, companyId: string, data: Record<string, unknown>): MenuNode {
  return {
    id,
    companyId,
    boardId: (data.boardId as string) ?? '',
    nodeType: data.nodeType === 'product' ? 'product' : 'family',
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    name: (data.name as string) ?? '',
    description: (data.description as string) ?? '',
    allergens: Array.isArray(data.allergens) ? (data.allergens as string[]) : [],
    priceCents: typeof data.priceCents === 'number' ? data.priceCents : null,
    priceCurrency: typeof data.priceCurrency === 'string' && data.priceCurrency.trim()
      ? data.priceCurrency.trim().toUpperCase()
      : 'EUR',
    photoUrl: (data.photoUrl as string) ?? '',
    active: data.active !== false,
    availability: normalizeMenuCategoryAvailability(data.availability),
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
  }
}


export async function getCompanyMenuBoards(companyId: string): Promise<MenuBoard[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoMenuBoards()
  }

  const boardsRef = collection(db, 'companies', companyId, 'menuBoards')
  const snapshot = await getDocs(query(boardsRef, limit(COMPANY_MENU_BOARD_LIMIT)))

  return snapshot.docs
    .map((boardDoc) => mapBoard(boardDoc.id, companyId, boardDoc.data() as Record<string, unknown>))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

export async function getPublicCompanyMenuBoards(
  companyId: string,
  _knownPlanId?: string,
): Promise<MenuBoard[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoMenuBoards().filter((board) => board.active)
  }

  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  // Solo la lista de cartas: el servidor no lee los platos.
  const response = await fetch(`${API_BASE}/api/public/menus/${encodeURIComponent(companyId)}?boardsOnly=1`)
  if (!response.ok) {
    throw new Error('No se pudo cargar la carta.')
  }
  const payload = await response.json() as { boards?: unknown }
  const rawBoards = Array.isArray(payload.boards) ? payload.boards : []
  return rawBoards
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => mapBoard(String(item.id ?? ''), companyId, item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

export async function getCompanyMenuNodes(companyId: string, boardId?: string): Promise<MenuNode[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoMenuNodes(boardId)
  }

  const nodesRef = collection(db, 'companies', companyId, 'menuNodes')
  const snapshot = await getDocs(
    boardId
      ? query(nodesRef, where('boardId', '==', boardId), limit(400))
      : query(nodesRef, limit(400)),
  )

  return snapshot.docs
    .map((nodeDoc) => mapNode(nodeDoc.id, companyId, nodeDoc.data() as Record<string, unknown>))
    .filter((node) => (boardId ? node.boardId === boardId : true))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

export async function getPublicCompanyMenuNodes(companyId: string, boardId?: string): Promise<MenuNode[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoMenuNodes(boardId).filter((node) => node.active)
  }

  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const qs = boardId ? `?boardId=${encodeURIComponent(boardId)}` : ''
  const response = await fetch(`${API_BASE}/api/public/menus/${encodeURIComponent(companyId)}${qs}`)
  if (!response.ok) {
    throw new Error('No se pudo cargar la carta.')
  }
  const payload = await response.json() as { nodes?: unknown }
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : []
  return rawNodes
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => mapNode(String(item.id ?? ''), companyId, item))
    .filter((node) => (boardId ? node.boardId === boardId : true))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

const menuPath = (companyId: string, suffix: string) => `/${encodeURIComponent(companyId)}/menu${suffix}`

export async function createCompanyMenuBoard(
  companyId: string,
  input: MenuBoardInput,
): Promise<string> {
  rejectIfDemoCompanyWrite(companyId)
  const data = await callCompanyApi<{ id: string }>(menuPath(companyId, '/boards'), 'POST', input, 'No se pudo crear la carta.')
  return data.id
}

export async function updateCompanyMenuBoard(
  companyId: string,
  boardId: string,
  input: MenuBoardInput,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(menuPath(companyId, `/boards/${encodeURIComponent(boardId)}`), 'PUT', input, 'No se pudo guardar la carta.')
}

export async function setCompanyMenuBoardActive(
  companyId: string,
  boardId: string,
  active: boolean,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(menuPath(companyId, `/boards/${encodeURIComponent(boardId)}/active`), 'PATCH', { active }, 'No se pudo cambiar la carta.')
}

export async function deleteCompanyMenuBoard(companyId: string, boardId: string): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(menuPath(companyId, `/boards/${encodeURIComponent(boardId)}`), 'DELETE', undefined, 'No se pudo borrar la carta.')
}

export async function reorderCompanyMenuBoards(
  companyId: string,
  orderedBoardIds: string[],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(menuPath(companyId, '/boards-order'), 'PUT', { boardIds: orderedBoardIds }, 'No se pudo ordenar las cartas.')
}

export async function createCompanyMenuNode(
  companyId: string,
  input: MenuNodeInput,
): Promise<string> {
  rejectIfDemoCompanyWrite(companyId)
  const data = await callCompanyApi<{ id: string }>(menuPath(companyId, '/nodes'), 'POST', input, 'No se pudo crear el producto.')
  return data.id
}

export async function updateCompanyMenuNode(
  companyId: string,
  nodeId: string,
  input: MenuNodeInput,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(menuPath(companyId, `/nodes/${encodeURIComponent(nodeId)}`), 'PUT', input, 'No se pudo guardar el producto.')
}

export async function deleteCompanyMenuNode(companyId: string, nodeId: string): Promise<void> {
  await deleteCompanyMenuNodes(companyId, [nodeId])
}

export async function deleteCompanyMenuNodes(companyId: string, nodeIds: string[]): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  if (nodeIds.length === 0) {
    return
  }
  await callCompanyApi(menuPath(companyId, '/nodes/delete'), 'POST', { nodeIds }, 'No se pudo borrar.')
}

export async function createCompanyMenuNodesBatch(
  companyId: string,
  inputs: Array<MenuNodeInput & { id: string }>,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  if (inputs.length === 0) {
    return
  }
  for (let offset = 0; offset < inputs.length; offset += 1000) {
    await callCompanyApi(menuPath(companyId, '/nodes/batch'), 'POST', { nodes: inputs.slice(offset, offset + 1000) }, 'No se pudieron guardar los productos.')
  }
}

export async function reorderCompanyMenuNodes(
  companyId: string,
  updates: Array<{ nodeId: string; sortOrder: number; parentId?: string | null }>,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  if (updates.length === 0) {
    return
  }
  await callCompanyApi(menuPath(companyId, '/nodes-order'), 'PUT', { updates }, 'No se pudo ordenar.')
}
