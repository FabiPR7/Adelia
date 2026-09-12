import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { defaultMenuTemplate, normalizeMenuBackgroundImageOpacity } from '../data/menuTemplates'
import { clampPublicMenuBoardForPlan, planMaxCount, parsePlanId } from '../data/companyPlanLimits'
import { db } from '../config/firebase'
import { COMPANY_MENU_BOARD_LIMIT } from './firestoreQuery'
import { normalizeMenuCategoryAvailability } from '../utils/menuCategoryAvailability'
import type {
  MenuBoard,
  MenuBoardInput,
  MenuNode,
  MenuNodeInput,
  MenuTemplateConfig,
} from '../types/company'
import {
  getDemoMenuBoards,
  getDemoMenuNodes,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'

function mapTemplate(data: Record<string, unknown>): MenuTemplateConfig {
  const fallback = defaultMenuTemplate()

  return {
    templateId: (data.templateId as string) ?? fallback.templateId,
    backgroundColor: (data.backgroundColor as string) ?? fallback.backgroundColor,
    backgroundImageUrl: (data.backgroundImageUrl as string) ?? '',
    backgroundImageOpacity: normalizeMenuBackgroundImageOpacity(
      data.backgroundImageOpacity ?? fallback.backgroundImageOpacity,
    ),
    fontFamily: (data.fontFamily as string) ?? fallback.fontFamily,
    titleColor: (data.titleColor as string) ?? fallback.titleColor,
    textColor: (data.textColor as string) ?? fallback.textColor,
    accentColor: (data.accentColor as string) ?? fallback.accentColor,
    familyColor: (data.familyColor as string) ?? (data.accentColor as string) ?? fallback.familyColor,
    subfamilyColor: (data.subfamilyColor as string) ?? (data.textColor as string) ?? fallback.subfamilyColor,
    priceColor: (data.priceColor as string) ?? fallback.priceColor,
    layout: data.layout === 'grid' ? 'grid' : 'list',
    showPhotos: data.showPhotos !== false,
    showAllergens: data.showAllergens !== false,
    showDescriptions: data.showDescriptions !== false,
  }
}

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

function serializeBoard(companyId: string, input: MenuBoardInput) {
  return {
    companyId,
    name: input.name.trim(),
    active: input.active,
    sortOrder: input.sortOrder,
    template: input.template,
    pdfUrl: input.pdfUrl?.trim() ?? '',
    pdfFileName: input.pdfFileName?.trim() ?? '',
    pdfPages: typeof input.pdfPages === 'number' && input.pdfPages > 0 ? input.pdfPages : 0,
    updatedAt: serverTimestamp(),
  }
}

function serializeNode(companyId: string, input: MenuNodeInput) {
  return {
    companyId,
    boardId: input.boardId,
    nodeType: input.nodeType,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    name: input.name.trim(),
    description: input.description.trim(),
    allergens: input.allergens,
    priceCents: input.nodeType === 'product' ? input.priceCents : null,
    priceCurrency: input.nodeType === 'product' ? input.priceCurrency : 'EUR',
    photoUrl: input.nodeType === 'product' ? input.photoUrl.trim() : '',
    active: input.active,
    availability: input.nodeType === 'family'
      ? normalizeMenuCategoryAvailability(input.availability)
      : { enabled: false, start: '', end: '' },
    updatedAt: serverTimestamp(),
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
  knownPlanId?: string,
): Promise<MenuBoard[]> {
  const boardsRef = collection(db, 'companies', companyId, 'menuBoards')
  const boardsQuery = query(boardsRef, where('active', '==', true), limit(COMPANY_MENU_BOARD_LIMIT))
  // El doc de empresa no es de lectura pública. La API pública nos pasa el plan;
  // si no, lo intentamos leer y, si las reglas lo niegan, seguimos sin recortar
  // por plan (mejor mostrar de más que romper la carta).
  const [snapshot, planIdFromDoc] = await Promise.all([
    getDocs(boardsQuery),
    knownPlanId
      ? Promise.resolve<string | undefined>(undefined)
      : getDoc(doc(db, 'companies', companyId))
          .then((snap) => (snap.data()?.planId as string | undefined))
          .catch(() => undefined),
  ])

  const resolvedPlanId = knownPlanId ?? planIdFromDoc
  const boards = snapshot.docs
    .map((boardDoc) => mapBoard(boardDoc.id, companyId, boardDoc.data() as Record<string, unknown>))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))

  if (!resolvedPlanId) {
    return boards
  }

  const planId = parsePlanId(resolvedPlanId)
  const maxMenus = planMaxCount(planId, 'menus')
  const clamped = boards.map((board) => clampPublicMenuBoardForPlan(board, planId))

  return maxMenus == null ? clamped : clamped.slice(0, maxMenus)
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
  const nodesRef = collection(db, 'companies', companyId, 'menuNodes')
  const nodesQuery = boardId
    ? query(nodesRef, where('active', '==', true), where('boardId', '==', boardId))
    : query(nodesRef, where('active', '==', true), limit(200))
  const snapshot = await getDocs(nodesQuery).catch(() => getDocs(
    boardId
      ? query(nodesRef, where('boardId', '==', boardId), limit(200))
      : query(nodesRef, limit(200)),
  ))

  return snapshot.docs
    .map((nodeDoc) => mapNode(nodeDoc.id, companyId, nodeDoc.data() as Record<string, unknown>))
    .filter((node) => (boardId ? node.boardId === boardId : true))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

export async function createCompanyMenuBoard(
  companyId: string,
  input: MenuBoardInput,
): Promise<string> {
  rejectIfDemoCompanyWrite(companyId)
  const boardsRef = collection(db, 'companies', companyId, 'menuBoards')
  const docRef = await addDoc(boardsRef, {
    ...serializeBoard(companyId, input),
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateCompanyMenuBoard(
  companyId: string,
  boardId: string,
  input: MenuBoardInput,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const boardRef = doc(db, 'companies', companyId, 'menuBoards', boardId)
  await updateDoc(boardRef, serializeBoard(companyId, input))
}

export async function setCompanyMenuBoardActive(
  companyId: string,
  boardId: string,
  active: boolean,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const boardRef = doc(db, 'companies', companyId, 'menuBoards', boardId)
  await updateDoc(boardRef, { active, updatedAt: serverTimestamp() })
}

export async function deleteCompanyMenuBoard(companyId: string, boardId: string): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const nodes = await getCompanyMenuNodes(companyId, boardId)
  const batch = writeBatch(db)

  for (const node of nodes) {
    batch.delete(doc(db, 'companies', companyId, 'menuNodes', node.id))
  }

  batch.delete(doc(db, 'companies', companyId, 'menuBoards', boardId))
  await batch.commit()
}

export async function reorderCompanyMenuBoards(
  companyId: string,
  orderedBoardIds: string[],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const batch = writeBatch(db)

  orderedBoardIds.forEach((boardId, index) => {
    batch.update(doc(db, 'companies', companyId, 'menuBoards', boardId), {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}

export async function createCompanyMenuNode(
  companyId: string,
  input: MenuNodeInput,
): Promise<string> {
  rejectIfDemoCompanyWrite(companyId)
  const nodesRef = collection(db, 'companies', companyId, 'menuNodes')
  const docRef = await addDoc(nodesRef, {
    ...serializeNode(companyId, input),
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateCompanyMenuNode(
  companyId: string,
  nodeId: string,
  input: MenuNodeInput,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const nodeRef = doc(db, 'companies', companyId, 'menuNodes', nodeId)
  await updateDoc(nodeRef, serializeNode(companyId, input))
}

export async function deleteCompanyMenuNode(companyId: string, nodeId: string): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const nodeRef = doc(db, 'companies', companyId, 'menuNodes', nodeId)
  await deleteDoc(nodeRef)
}

export async function deleteCompanyMenuNodes(companyId: string, nodeIds: string[]): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  if (nodeIds.length === 0) {
    return
  }

  const batch = writeBatch(db)

  for (const nodeId of nodeIds) {
    batch.delete(doc(db, 'companies', companyId, 'menuNodes', nodeId))
  }

  await batch.commit()
}

export async function createCompanyMenuNodesBatch(
  companyId: string,
  inputs: Array<MenuNodeInput & { id: string }>,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  if (inputs.length === 0) {
    return
  }

  const chunkSize = 400

  for (let offset = 0; offset < inputs.length; offset += chunkSize) {
    const chunk = inputs.slice(offset, offset + chunkSize)
    const batch = writeBatch(db)

    for (const input of chunk) {
      batch.set(doc(db, 'companies', companyId, 'menuNodes', input.id), {
        ...serializeNode(companyId, input),
        createdAt: serverTimestamp(),
      })
    }

    await batch.commit()
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

  const batch = writeBatch(db)

  for (const update of updates) {
    const payload: Record<string, unknown> = {
      sortOrder: update.sortOrder,
      updatedAt: serverTimestamp(),
    }

    if (update.parentId !== undefined) {
      payload.parentId = update.parentId
    }

    batch.update(doc(db, 'companies', companyId, 'menuNodes', update.nodeId), payload)
  }

  await batch.commit()
}
