import { adminDb } from '../firebase-admin.ts'
import {
  parseStoredPlanId,
  planAllowsMenuGrid,
  planAllowsMenuPdf,
  planMaxMenus,
  type StoredPlanId,
} from '../company/planLimits.ts'

const BOARD_LIMIT = 12
const NODE_LIMIT = 200

export interface PublicMenuBoardPayload {
  id: string
  companyId: string
  name: string
  active: boolean
  sortOrder: number
  template: Record<string, unknown>
  pdfUrl: string
  pdfFileName: string
  pdfPages: number
}

export interface PublicMenuNodePayload {
  id: string
  companyId: string
  boardId: string
  nodeType: 'product' | 'family'
  parentId: string | null
  sortOrder: number
  name: string
  description: string
  allergens: string[]
  priceCents: number | null
  priceCurrency: string
  photoUrl: string
  active: boolean
  availability: unknown
}

function clampBoardForPlan(board: PublicMenuBoardPayload, planId: StoredPlanId): PublicMenuBoardPayload {
  const template = { ...board.template }
  if (!planAllowsMenuGrid(planId) && template.layout === 'grid') {
    template.layout = 'list'
  }
  return {
    ...board,
    pdfUrl: planAllowsMenuPdf(planId) ? board.pdfUrl : '',
    pdfFileName: planAllowsMenuPdf(planId) ? board.pdfFileName : '',
    pdfPages: planAllowsMenuPdf(planId) ? board.pdfPages : 0,
    template,
  }
}

function mapBoard(id: string, companyId: string, data: FirebaseFirestore.DocumentData): PublicMenuBoardPayload {
  const template = data.template && typeof data.template === 'object'
    ? { ...(data.template as Record<string, unknown>) }
    : {}
  return {
    id,
    companyId,
    name: typeof data.name === 'string' ? data.name : '',
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    template,
    pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : '',
    pdfFileName: typeof data.pdfFileName === 'string' ? data.pdfFileName : '',
    pdfPages: typeof data.pdfPages === 'number' && data.pdfPages > 0 ? data.pdfPages : 0,
  }
}

function mapNode(id: string, companyId: string, data: FirebaseFirestore.DocumentData): PublicMenuNodePayload {
  return {
    id,
    companyId,
    boardId: typeof data.boardId === 'string' ? data.boardId : '',
    nodeType: data.nodeType === 'product' ? 'product' : 'family',
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    name: typeof data.name === 'string' ? data.name : '',
    description: typeof data.description === 'string' ? data.description : '',
    allergens: Array.isArray(data.allergens)
      ? data.allergens.filter((item): item is string => typeof item === 'string').slice(0, 40)
      : [],
    priceCents: typeof data.priceCents === 'number' ? data.priceCents : null,
    priceCurrency: typeof data.priceCurrency === 'string' && data.priceCurrency.trim()
      ? data.priceCurrency.trim().toUpperCase()
      : 'EUR',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    active: data.active !== false,
    availability: data.availability ?? null,
  }
}

export async function listPublicCompanyMenu(
  companyId: string,
  boardId?: string,
): Promise<{ boards: PublicMenuBoardPayload[]; nodes: PublicMenuNodePayload[] }> {
  const companySnap = await adminDb.collection('companies').doc(companyId).get()
  if (!companySnap.exists || companySnap.data()?.deactivated === true) {
    return { boards: [], nodes: [] }
  }

  const planId = parseStoredPlanId(companySnap.data()?.planId)
  const maxMenus = planMaxMenus(planId)

  const boardsSnap = await adminDb
    .collection('companies')
    .doc(companyId)
    .collection('menuBoards')
    .where('active', '==', true)
    .limit(BOARD_LIMIT)
    .get()

  let boards = boardsSnap.docs
    .map((docSnap) => clampBoardForPlan(mapBoard(docSnap.id, companyId, docSnap.data()), planId))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'))

  if (maxMenus != null) {
    boards = boards.slice(0, maxMenus)
  }

  const allowedBoardIds = new Set(boards.map((board) => board.id))
  const nodesRef = adminDb.collection('companies').doc(companyId).collection('menuNodes')
  let nodesQuery: FirebaseFirestore.Query = nodesRef.where('active', '==', true)
  if (boardId && allowedBoardIds.has(boardId)) {
    nodesQuery = nodesQuery.where('boardId', '==', boardId)
  }
  const nodesSnap = await nodesQuery.limit(NODE_LIMIT).get()

  const nodes = nodesSnap.docs
    .map((docSnap) => mapNode(docSnap.id, companyId, docSnap.data()))
    .filter((node) => allowedBoardIds.has(node.boardId) && (!boardId || node.boardId === boardId))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'))

  return { boards, nodes }
}
