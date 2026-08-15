import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUploader from '../../components/ImageUploader'
import MenuExcelExportModal from '../../components/menu/MenuExcelExportModal'
import MenuExcelImportModal, { type MenuExcelImportMode } from '../../components/menu/MenuExcelImportModal'
import MenuPreview from '../../components/menu/MenuPreview'
import { useAuth } from '../../context/AuthContext'
import {
  defaultMenuTemplate,
  getMenuTemplatePreset,
  MENU_FONT_OPTIONS,
  MENU_LAYOUT_OPTIONS,
  MENU_TEMPLATE_PRESETS,
} from '../../data/menuTemplates'
import { DEFAULT_MENU_CURRENCY, MENU_CURRENCY_OPTIONS } from '../../data/menuCurrencies'
import { getMenuAllergenIcon, getMenuAllergenLabel, MENU_ALLERGEN_OPTIONS } from '../../data/menuAllergens'
import { getFirestoreErrorMessage } from '../../services/firestore'
import { copyTextToClipboard, getPublicMenuBoardUrl, slugify } from '../../utils/helpers'
import { downloadBookingQrCode } from '../../utils/bookingQr'
import { resolveBrandedQrOptions } from '../../utils/qrBranding'
import QrCustomizerModal from '../../components/QrCustomizerModal'
import {
  createCompanyMenuBoard,
  createCompanyMenuNode,
  deleteCompanyMenuBoard,
  deleteCompanyMenuNodes,
  getCompanyMenuBoards,
  getCompanyMenuNodes,
  reorderCompanyMenuBoards,
  reorderCompanyMenuNodes,
  setCompanyMenuBoardActive,
  updateCompanyMenuBoard,
  updateCompanyMenuNode,
} from '../../services/companyMenu'
import type { MenuBoard, MenuBoardInput, MenuCategoryAvailability, MenuNode, MenuNodeInput, MenuTemplateConfig } from '../../types'
import {
  buildMenuTree,
  canDropNode,
  collectDescendantIds,
  flattenMenuTree,
  formatMenuPrice,
  getFamilyTypeLabel,
  getNodePathLabel,
  getParentFamilyName,
  getProductCopyName,
  moveNode,
  moveNodeToRoot,
  parseMenuPriceInput,
  resolveDropPosition,
  sanitizeMenuPriceInput,
  validateMenuNodeInput,
  type MenuDropPosition,
  type MenuTreeNode,
} from '../../utils/menuTree'
import {
  DEFAULT_MENU_CATEGORY_AVAILABILITY,
  formatMenuCategoryAvailability,
} from '../../utils/menuCategoryAvailability'
import styles from './CompanyMenu.module.css'

interface CompanyMenuProps {
  companyId: string
}

type EditorTab = 'content' | 'design'

interface NodeFormState {
  mode: 'create' | 'edit'
  nodeType: MenuNode['nodeType']
  parentId: string | null
  nodeId: string | null
  name: string
  description: string
  allergens: string[]
  priceInput: string
  priceCurrency: string
  photoUrl: string
  active: boolean
  availabilityEnabled: boolean
  availabilityStart: string
  availabilityEnd: string
}

function boardToInput(board: MenuBoard): MenuBoardInput {
  return {
    name: board.name,
    active: board.active,
    sortOrder: board.sortOrder,
    template: board.template,
  }
}

function emptyNodeForm(
  nodeType: MenuNode['nodeType'],
  parentId: string | null,
): NodeFormState {
  return {
    mode: 'create',
    nodeType,
    parentId,
    nodeId: null,
    name: '',
    description: '',
    allergens: [],
    priceInput: '',
    priceCurrency: DEFAULT_MENU_CURRENCY,
    photoUrl: '',
    active: true,
    availabilityEnabled: false,
    availabilityStart: DEFAULT_MENU_CATEGORY_AVAILABILITY.start,
    availabilityEnd: DEFAULT_MENU_CATEGORY_AVAILABILITY.end,
  }
}

function availabilityToForm(availability: MenuCategoryAvailability) {
  return {
    availabilityEnabled: availability.enabled,
    availabilityStart: availability.start || DEFAULT_MENU_CATEGORY_AVAILABILITY.start,
    availabilityEnd: availability.end || DEFAULT_MENU_CATEGORY_AVAILABILITY.end,
  }
}

function formToAvailability(form: NodeFormState): MenuCategoryAvailability {
  return {
    enabled: form.availabilityEnabled,
    start: form.availabilityStart,
    end: form.availabilityEnd,
  }
}

function nodeToForm(node: MenuNode): NodeFormState {
  return {
    mode: 'edit',
    nodeType: node.nodeType,
    parentId: node.parentId,
    nodeId: node.id,
    name: node.name,
    description: node.description,
    allergens: [...node.allergens],
    priceInput: node.priceCents != null ? (node.priceCents / 100).toFixed(2).replace('.', ',') : '',
    priceCurrency: node.priceCurrency || DEFAULT_MENU_CURRENCY,
    photoUrl: node.photoUrl,
    active: node.active,
    ...availabilityToForm(node.availability),
  }
}

function nodeToCopyForm(node: MenuNode, productNames: string[]): NodeFormState {
  const form = nodeToForm(node)

  return {
    ...form,
    mode: 'create',
    nodeId: null,
    name: getProductCopyName(node.name, productNames),
  }
}

function CompanyMenu({ companyId }: CompanyMenuProps) {
  const { user, profile, company, refreshCompany } = useAuth()
  const [boards, setBoards] = useState<MenuBoard[]>([])
  const [nodes, setNodes] = useState<MenuNode[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [editorTab, setEditorTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boardNameDraft, setBoardNameDraft] = useState('')
  const [templateDraft, setTemplateDraft] = useState<MenuTemplateConfig>(defaultMenuTemplate())
  const [nodeForm, setNodeForm] = useState<NodeFormState | null>(null)
  const [nodeFormError, setNodeFormError] = useState<string | null>(null)
  const [deleteBoardTarget, setDeleteBoardTarget] = useState<MenuBoard | null>(null)
  const [deleteNodeTarget, setDeleteNodeTarget] = useState<MenuNode | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{ targetId: string | null; position: MenuDropPosition } | null>(null)
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [excelImportOpen, setExcelImportOpen] = useState(false)
  const [excelExportOpen, setExcelExportOpen] = useState(false)
  const [excelImportMode, setExcelImportMode] = useState<MenuExcelImportMode>('new-board')
  const [newBoardName, setNewBoardName] = useState('')
  const [createBoardError, setCreateBoardError] = useState<string | null>(null)
  const [menuShareCopied, setMenuShareCopied] = useState(false)
  const [isDownloadingMenuQr, setIsDownloadingMenuQr] = useState(false)
  const [menuQrCustomizerOpen, setMenuQrCustomizerOpen] = useState(false)

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  )

  const selectedBoardPublicUrl = useMemo(() => {
    if (!company?.slug || !selectedBoard) {
      return ''
    }

    return getPublicMenuBoardUrl(company.slug, selectedBoard.id)
  }, [company?.slug, selectedBoard])

  useEffect(() => {
    setMenuShareCopied(false)
  }, [selectedBoardId])

  const boardNodes = useMemo(
    () => nodes.filter((node) => node.boardId === selectedBoardId),
    [nodes, selectedBoardId],
  )

  const boardTree = useMemo(() => buildMenuTree(boardNodes), [boardNodes])
  const flatTree = useMemo(() => flattenMenuTree(boardTree), [boardTree])

  const loadMenu = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [boardData, nodeData] = await Promise.all([
        getCompanyMenuBoards(companyId),
        getCompanyMenuNodes(companyId),
      ])

      setBoards(boardData)
      setNodes(nodeData)
      setSelectedBoardId((current) => current ?? boardData[0]?.id ?? null)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (!user || profile?.companyId !== companyId) {
      return
    }

    void loadMenu()
  }, [user, profile?.companyId, companyId, loadMenu])

  useEffect(() => {
    if (!selectedBoard) {
      return
    }

    setBoardNameDraft(selectedBoard.name)
    setTemplateDraft(selectedBoard.template)
  }, [selectedBoard])

  const persistBoard = async (input: MenuBoardInput) => {
    if (!selectedBoard) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateCompanyMenuBoard(companyId, selectedBoard.id, input)
      setBoards((current) =>
        current.map((board) =>
          board.id === selectedBoard.id
            ? { ...board, ...input, updatedAt: new Date() }
            : board,
        ),
      )
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openCreateBoardModal = () => {
    setNewBoardName('')
    setCreateBoardError(null)
    setCreateBoardOpen(true)
  }

  const openExcelImportModal = (mode: MenuExcelImportMode) => {
    setExcelImportMode(mode)
    setExcelImportOpen(true)
  }

  const handleExcelImportSuccess = async (boardId: string) => {
    setExcelImportOpen(false)
    await loadMenu()
    setSelectedBoardId(boardId)
    setEditorTab('content')
  }

  const handleOpenMenuBoardPublic = () => {
    if (!selectedBoardPublicUrl) {
      return
    }

    window.open(selectedBoardPublicUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCopyMenuBoardLink = async () => {
    if (!selectedBoardPublicUrl) {
      return
    }

    setError(null)
    const copied = await copyTextToClipboard(selectedBoardPublicUrl)

    if (copied) {
      setMenuShareCopied(true)
      window.setTimeout(() => setMenuShareCopied(false), 2000)
      return
    }

    setError('No se pudo copiar el enlace. Activa la carta e inténtalo de nuevo.')
  }

  const handleDownloadMenuBoardQr = async () => {
    if (!selectedBoardPublicUrl || !selectedBoard || !company) {
      return
    }

    setIsDownloadingMenuQr(true)
    setError(null)

    try {
      const filename = `qr-carta-${slugify(selectedBoard.name)}-${slugify(company.slug || company.name)}.png`
      const renderOptions = resolveBrandedQrOptions(company.qrBranding.menu, 'menu', {
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        menuBoardName: selectedBoard.name,
      })
      await downloadBookingQrCode(selectedBoardPublicUrl, filename, renderOptions)
    } catch {
      setError('No se pudo generar el código QR de la carta.')
    } finally {
      setIsDownloadingMenuQr(false)
    }
  }

  const closeCreateBoardModal = () => {
    if (saving) {
      return
    }

    setCreateBoardOpen(false)
    setNewBoardName('')
    setCreateBoardError(null)
  }

  const handleCreateBoard = async () => {
    const name = newBoardName.trim()

    if (!name) {
      setCreateBoardError('Indica un nombre para la carta.')
      return
    }

    setSaving(true)
    setError(null)
    setCreateBoardError(null)

    try {
      const id = await createCompanyMenuBoard(companyId, {
        name,
        active: true,
        sortOrder: boards.length,
        template: defaultMenuTemplate(),
      })

      await loadMenu()
      setSelectedBoardId(id)
      setCreateBoardOpen(false)
      setNewBoardName('')
    } catch (err) {
      setCreateBoardError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBoardActive = async (board: MenuBoard) => {
    setSaving(true)
    try {
      await setCompanyMenuBoardActive(companyId, board.id, !board.active)
      setBoards((current) =>
        current.map((entry) =>
          entry.id === board.id ? { ...entry, active: !board.active } : entry,
        ),
      )
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleMoveBoard = async (boardId: string, direction: -1 | 1) => {
    const ids = boards.map((board) => board.id)
    const index = ids.indexOf(boardId)
    const swapIndex = index + direction

    if (index === -1 || swapIndex < 0 || swapIndex >= ids.length) {
      return
    }

    const reordered = [...ids]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]

    setSaving(true)
    try {
      await reorderCompanyMenuBoards(companyId, reordered)
      setBoards((current) =>
        [...current]
          .sort((left, right) => reordered.indexOf(left.id) - reordered.indexOf(right.id))
          .map((board, sortOrder) => ({ ...board, sortOrder })),
      )
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBoardMeta = async () => {
    if (!selectedBoard || !boardNameDraft.trim()) {
      setError('Indica un nombre para la carta.')
      return
    }

    await persistBoard({
      ...boardToInput(selectedBoard),
      name: boardNameDraft.trim(),
    })
  }

  const handleSaveTemplate = async () => {
    if (!selectedBoard) {
      return
    }

    await persistBoard({
      ...boardToInput(selectedBoard),
      name: boardNameDraft.trim() || selectedBoard.name,
      template: templateDraft,
    })
  }

  const applyTemplatePreset = (templateId: string) => {
    const preset = getMenuTemplatePreset(templateId)
    if (!preset) {
      return
    }

    setTemplateDraft({ ...preset.config })
  }

  const openCreateNode = (nodeType: MenuNode['nodeType'], parentId: string | null) => {
    if (!selectedBoardId) {
      return
    }

    setNodeForm(emptyNodeForm(nodeType, parentId))
    setNodeFormError(null)
  }

  const openEditNode = (node: MenuNode) => {
    setNodeForm(nodeToForm(node))
    setNodeFormError(null)
  }

  const openCopyProduct = (node: MenuNode) => {
    if (node.nodeType !== 'product') {
      return
    }

    const productNames = boardNodes
      .filter((entry) => entry.nodeType === 'product')
      .map((entry) => entry.name)

    setNodeForm(nodeToCopyForm(node, productNames))
    setNodeFormError(null)
  }

  const toggleAllergen = (allergen: string) => {
    setNodeForm((current) => {
      if (!current) {
        return current
      }

      const exists = current.allergens.includes(allergen)
      return {
        ...current,
        allergens: exists
          ? current.allergens.filter((entry) => entry !== allergen)
          : [...current.allergens, allergen],
      }
    })
  }

  const saveNodeForm = async () => {
    if (!nodeForm || !selectedBoardId) {
      return
    }

    const priceCents = nodeForm.nodeType === 'product' ? parseMenuPriceInput(nodeForm.priceInput) : null
    const validation = validateMenuNodeInput({
      name: nodeForm.name,
      nodeType: nodeForm.nodeType,
      priceCents,
      availability: nodeForm.nodeType === 'family' ? formToAvailability(nodeForm) : undefined,
    })

    if (validation) {
      setNodeFormError(validation)
      return
    }

    const input: MenuNodeInput = {
      boardId: selectedBoardId,
      nodeType: nodeForm.nodeType,
      parentId: nodeForm.parentId,
      sortOrder:
        nodeForm.mode === 'edit' && nodeForm.nodeId
          ? (boardNodes.find((node) => node.id === nodeForm.nodeId)?.sortOrder ?? boardNodes.length)
          : boardNodes.filter((node) => node.parentId === nodeForm.parentId).length,
      name: nodeForm.name,
      description: nodeForm.description,
      allergens: nodeForm.allergens,
      priceCents,
      priceCurrency: nodeForm.priceCurrency,
      photoUrl: nodeForm.photoUrl,
      active: nodeForm.active,
      availability: nodeForm.nodeType === 'family'
        ? formToAvailability(nodeForm)
        : { enabled: false, start: '', end: '' },
    }

    setSaving(true)
    setNodeFormError(null)

    try {
      if (nodeForm.mode === 'edit' && nodeForm.nodeId) {
        await updateCompanyMenuNode(companyId, nodeForm.nodeId, input)
      } else {
        await createCompanyMenuNode(companyId, input)
      }

      const nodeData = await getCompanyMenuNodes(companyId)
      setNodes(nodeData)
      setNodeForm(null)
    } catch (err) {
      setNodeFormError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteNode = async () => {
    if (!deleteNodeTarget) {
      return
    }

    setSaving(true)
    try {
      const ids = collectDescendantIds(nodes, deleteNodeTarget.id)
      await deleteCompanyMenuNodes(companyId, ids)
      setNodes((current) => current.filter((node) => !ids.includes(node.id)))
      setDeleteNodeTarget(null)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteBoard = async () => {
    if (!deleteBoardTarget) {
      return
    }

    setSaving(true)
    try {
      await deleteCompanyMenuBoard(companyId, deleteBoardTarget.id)
      const remaining = boards.filter((board) => board.id !== deleteBoardTarget.id)
      setBoards(remaining)
      setNodes((current) => current.filter((node) => node.boardId !== deleteBoardTarget.id))
      setSelectedBoardId(remaining[0]?.id ?? null)
      setDeleteBoardTarget(null)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const persistNodeOrder = async (nextNodes: MenuNode[]) => {
    if (!selectedBoardId) {
      return
    }

    const updates = nextNodes
      .filter((node) => node.boardId === selectedBoardId)
      .map((node) => ({ nodeId: node.id, sortOrder: node.sortOrder, parentId: node.parentId }))

    setNodes(nextNodes)
    setSaving(true)

    try {
      await reorderCompanyMenuNodes(companyId, updates)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
      await loadMenu()
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = () => {
    setDraggingNodeId(null)
    setDropHint(null)
  }

  const handleDragOverNode = (event: React.DragEvent<HTMLDivElement>, node: MenuTreeNode) => {
    event.preventDefault()
    if (!draggingNodeId) {
      return
    }

    const row = event.currentTarget
    const position = resolveDropPosition(
      event.clientY,
      row.getBoundingClientRect().top,
      row.getBoundingClientRect().height,
      node.nodeType === 'family',
    )

    if (canDropNode(boardNodes, draggingNodeId, node.id, position)) {
      setDropHint({ targetId: node.id, position })
    }
  }

  const handleDragOverRoot = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!draggingNodeId) {
      return
    }

    if (canDropNode(boardNodes, draggingNodeId, null, 'root')) {
      setDropHint({ targetId: null, position: 'root' })
    }
  }

  const handleDropOnNode = (event: React.DragEvent<HTMLDivElement>, node: MenuTreeNode) => {
    event.preventDefault()
    if (!draggingNodeId) {
      return
    }

    const row = event.currentTarget
    const position = dropHint?.targetId === node.id
      ? dropHint.position
      : resolveDropPosition(
        event.clientY,
        row.getBoundingClientRect().top,
        row.getBoundingClientRect().height,
        node.nodeType === 'family',
      )

    if (!canDropNode(boardNodes, draggingNodeId, node.id, position)) {
      handleDragEnd()
      return
    }

    const nextNodes = moveNode(nodes, draggingNodeId, node.id, position)
    handleDragEnd()
    void persistNodeOrder(nextNodes)
  }

  const handleDropOnRoot = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!draggingNodeId || !canDropNode(boardNodes, draggingNodeId, null, 'root')) {
      handleDragEnd()
      return
    }

    const nextNodes = moveNodeToRoot(nodes, draggingNodeId)
    handleDragEnd()
    void persistNodeOrder(nextNodes)
  }

  const getTreeRowDropClass = (node: MenuTreeNode) => {
    if (dropHint?.targetId !== node.id) {
      return ''
    }

    if (dropHint.position === 'inside') {
      return styles.treeRowDropInside
    }

    if (dropHint.position === 'before') {
      return styles.treeRowDropBefore
    }

    return styles.treeRowDropAfter
  }

  const renderTreeNode = (node: MenuTreeNode) => {
    const pathLabel = getNodePathLabel(node, boardNodes)
    const isFamily = node.nodeType === 'family'
    const isSubfamily = isFamily && Boolean(node.parentId)

    return (
      <div key={node.id} className={styles.treeBlock}>
        <div
          className={[
            styles.treeRow,
            isFamily ? styles.treeRowFamily : styles.treeRowProduct,
            isSubfamily ? styles.treeRowSubfamily : '',
            draggingNodeId === node.id ? styles.treeRowDragging : '',
            getTreeRowDropClass(node),
          ].filter(Boolean).join(' ')}
          draggable
          onDragStart={() => setDraggingNodeId(node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => handleDragOverNode(event, node)}
          onDrop={(event) => handleDropOnNode(event, node)}
        >
          <div className={styles.treeRowGuide} aria-hidden="true">
            {Array.from({ length: node.depth }, (_, index) => (
              <span key={index} className={styles.treeDepthLine} />
            ))}
          </div>
          <span className={styles.dragHandle} aria-hidden="true">⠿</span>
          <div className={styles.treeMain}>
            <div className={styles.treeTitleRow}>
              <span
                className={
                  isFamily
                    ? node.parentId
                      ? styles.subfamilyTag
                      : styles.familyTag
                    : styles.productTag
                }
              >
                {getFamilyTypeLabel(node, boardNodes)}
              </span>
              <strong>{node.name || 'Sin nombre'}</strong>
              {isFamily && node.availability.enabled ? (
                <span className={styles.availabilityTag}>
                  {formatMenuCategoryAvailability(node.availability)}
                </span>
              ) : null}
              {node.nodeType === 'product' && node.priceCents != null ? (
                <span className={styles.treePrice}>
                  {formatMenuPrice(node.priceCents, node.priceCurrency)}
                </span>
              ) : null}
              {node.nodeType === 'product' && node.allergens.length > 0 ? (
                <span className={styles.treeAllergens} aria-label={`Alérgenos: ${node.allergens.map(getMenuAllergenLabel).join(', ')}`}>
                  {node.allergens.map((allergen) => (
                    <span
                      key={allergen}
                      className={styles.treeAllergenIcon}
                      title={getMenuAllergenLabel(allergen)}
                    >
                      {getMenuAllergenIcon(allergen)}
                    </span>
                  ))}
                </span>
              ) : null}
              {node.nodeType === 'product' && !node.active ? (
                <span className={styles.inactiveTag}>Oculto</span>
              ) : null}
            </div>
            {node.nodeType === 'product' && pathLabel ? (
              <p className={styles.treePath}>{pathLabel}</p>
            ) : null}
            {node.nodeType === 'product' && node.description ? (
              <p className={styles.treeDescription}>{node.description}</p>
            ) : null}
          </div>
          <div className={styles.treeActions}>
            {node.nodeType === 'family' ? (
              <>
                <button
                  type="button"
                  className={styles.treeIconBtn}
                  onClick={() => openCreateNode('family', node.id)}
                  title="Añadir subfamilia"
                  aria-label="Añadir subfamilia"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 3h8v3H2V3zm0 6h5v3H2V9zm7-3h5v6H9V6z" fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.treeIconBtn}
                  onClick={() => openCreateNode('product', node.id)}
                  title="Añadir producto"
                  aria-label="Añadir producto"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : null}
            {node.nodeType === 'product' ? (
              <button
                type="button"
                className={styles.treeIconBtn}
                onClick={() => openCopyProduct(node)}
                title="Copiar producto"
                aria-label="Copiar producto"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M5.5 2.5h6A1.5 1.5 0 0113 4v6.5h-1.5V4h-6V2.5zm-2 2H4A1.5 1.5 0 002.5 6v7A1.5 1.5 0 004 14.5h6A1.5 1.5 0 0011.5 13V11.5H13v1.5A3 3 0 0110 16H4a3 3 0 01-3-3V6a3 3 0 013-3h1.5v1.5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className={styles.treeIconBtn}
              onClick={() => openEditNode(node)}
              title="Editar"
              aria-label="Editar"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M11.3 2.7l2 2-8.6 8.6H2.7v-2.7l8.6-8.6zM10.6 3.4L3.4 10.6v.7h.7l7.2-7.2-.7-.7z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.treeIconBtn} ${styles.dangerBtn}`}
              onClick={() => setDeleteNodeTarget(node)}
              title="Eliminar"
              aria-label="Eliminar"
            >
              ✕
            </button>
          </div>
        </div>
        {node.children.length > 0 ? (
          <div className={node.depth === 0 ? styles.treeGroup : styles.treeGroupSub}>
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return <div className={styles.loading}>Cargando carta…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Carta digital</h1>
          <p>Crea cartas por categoría (desayuno, cena…), organiza familias y productos, y personaliza el diseño.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => openExcelImportModal('new-board')}
            disabled={saving}
          >
            Desde Excel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={openCreateBoardModal} disabled={saving}>
            + Agregar carta
          </button>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.layout}>
        <aside className={styles.boardSidebar}>
          <h2>Cartas</h2>
          {boards.length === 0 ? (
            <p className={styles.emptyHint}>Aún no tienes cartas. Crea la primera con «Agregar carta».</p>
          ) : (
            <ul className={styles.boardList}>
              {boards.map((board, index) => (
                <li key={board.id}>
                  <button
                    type="button"
                    className={`${styles.boardItem} ${selectedBoardId === board.id ? styles.boardItemActive : ''}`}
                    onClick={() => setSelectedBoardId(board.id)}
                  >
                    <span className={styles.boardItemName}>{board.name}</span>
                    <span className={board.active ? styles.boardActive : styles.boardInactive}>
                      {board.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </button>
                  <div className={styles.boardItemActions}>
                    <button type="button" onClick={() => void handleMoveBoard(board.id, -1)} disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => void handleMoveBoard(board.id, 1)} disabled={index === boards.length - 1}>↓</button>
                    <button type="button" onClick={() => void handleToggleBoardActive(board)}>
                      {board.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className={styles.dangerBtn} onClick={() => setDeleteBoardTarget(board)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`${styles.editor} ${editorTab === 'design' ? styles.editorDesignMode : ''}`}>
          {!selectedBoard ? (
            <div className={styles.emptyEditor}>
              <p>Selecciona o crea una carta para empezar.</p>
            </div>
          ) : (
            <>
              <div className={styles.editorHead}>
                <div className={styles.boardNameField}>
                  <label htmlFor="board-name">Nombre de la carta</label>
                  <div className={styles.inlineField}>
                    <input
                      id="board-name"
                      value={boardNameDraft}
                      onChange={(event) => setBoardNameDraft(event.target.value)}
                    />
                    <button type="button" onClick={() => void handleSaveBoardMeta()} disabled={saving}>
                      Guardar
                    </button>
                  </div>
                </div>

                <div className={styles.tabs}>
                  {(['content', 'design'] as EditorTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={editorTab === tab ? styles.tabActive : styles.tab}
                      onClick={() => setEditorTab(tab)}
                    >
                      {tab === 'content' ? 'Contenido' : 'Diseño y vista previa'}
                    </button>
                  ))}
                </div>
              </div>

              {editorTab === 'content' ? (
                <div className={styles.contentPanel}>
                  <div className={styles.contentToolbar}>
                    <button type="button" onClick={() => openCreateNode('family', null)}>+ Familia</button>
                    <button type="button" onClick={() => openCreateNode('product', null)}>+ Producto suelto</button>
                    <button type="button" onClick={() => setExcelExportOpen(true)}>
                      Descargar Excel
                    </button>
                    <button type="button" onClick={() => openExcelImportModal('existing-board')}>
                      Importar Excel
                    </button>
                    <span className={styles.toolbarDivider} aria-hidden="true" />
                    <button
                      type="button"
                      onClick={handleOpenMenuBoardPublic}
                      disabled={!selectedBoard?.active || !selectedBoardPublicUrl}
                      title={selectedBoard?.active ? 'Abrir la carta pública' : 'Activa la carta para compartirla'}
                    >
                      Ver carta
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyMenuBoardLink()}
                      disabled={!selectedBoard?.active || !selectedBoardPublicUrl}
                      title={selectedBoard?.active ? 'Copiar enlace público' : 'Activa la carta para compartirla'}
                    >
                      {menuShareCopied ? 'Enlace copiado' : 'Copiar enlace'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuQrCustomizerOpen(true)}
                      disabled={!selectedBoard?.active || !selectedBoardPublicUrl}
                      title={selectedBoard?.active ? 'Personalizar QR de la carta' : 'Activa la carta para compartirla'}
                    >
                      Personalizar QR
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadMenuBoardQr()}
                      disabled={!selectedBoard?.active || !selectedBoardPublicUrl || isDownloadingMenuQr}
                      title={selectedBoard?.active ? 'Descargar QR de la carta' : 'Activa la carta para compartirla'}
                    >
                      {isDownloadingMenuQr ? 'Generando QR…' : 'Descargar QR'}
                    </button>
                    <span className={styles.toolbarHint}>
                      Arrastra entre filas para reordenar o cambiar de familia; arriba para sacar al nivel principal
                    </span>
                  </div>

                  {flatTree.length === 0 ? (
                    <p className={styles.emptyHint}>Empieza añadiendo una familia (Entrantes, Carnes…) o un producto suelto.</p>
                  ) : (
                    <div className={styles.tree}>
                      <div
                        className={[
                          styles.rootDropZone,
                          dropHint?.position === 'root' ? styles.rootDropZoneActive : '',
                        ].filter(Boolean).join(' ')}
                        onDragOver={handleDragOverRoot}
                        onDragLeave={() => setDropHint((current) => (current?.position === 'root' ? null : current))}
                        onDrop={handleDropOnRoot}
                      >
                        Suelta aquí para mover al nivel principal (sin familia)
                      </div>
                      {boardTree.map((node) => renderTreeNode(node))}
                    </div>
                  )}
                </div>
              ) : null}

              {editorTab === 'design' && selectedBoard ? (
                <div className={styles.designWorkspace}>
                  <aside className={styles.designTools} aria-label="Herramientas de diseño">
                    <div className={styles.designToolsInner}>
                      <section className={styles.designSection}>
                        <h3>Colores y tipografía</h3>
                        <div className={styles.designGrid}>
                          <label>
                            Fondo
                            <input
                              type="color"
                              value={templateDraft.backgroundColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, backgroundColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Títulos
                            <input
                              type="color"
                              value={templateDraft.titleColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, titleColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Texto
                            <input
                              type="color"
                              value={templateDraft.textColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, textColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Acento
                            <input
                              type="color"
                              value={templateDraft.accentColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, accentColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Familias
                            <input
                              type="color"
                              value={templateDraft.familyColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, familyColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Subfamilias
                            <input
                              type="color"
                              value={templateDraft.subfamilyColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, subfamilyColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Precios
                            <input
                              type="color"
                              value={templateDraft.priceColor}
                              onChange={(event) => setTemplateDraft({ ...templateDraft, priceColor: event.target.value })}
                            />
                          </label>
                          <label>
                            Fuente
                            <select
                              value={MENU_FONT_OPTIONS.find((option) => option.value === templateDraft.fontFamily)?.id ?? 'inter'}
                              onChange={(event) => {
                                const font = MENU_FONT_OPTIONS.find((option) => option.id === event.target.value)
                                if (font) {
                                  setTemplateDraft({ ...templateDraft, fontFamily: font.value })
                                }
                              }}
                            >
                              {MENU_FONT_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Disposición
                            <select
                              value={templateDraft.layout}
                              onChange={(event) =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  layout: event.target.value as MenuTemplateConfig['layout'],
                                })
                              }
                            >
                              {MENU_LAYOUT_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Contenido visible</h3>
                        <div className={styles.toggleGrid}>
                          <label><input type="checkbox" checked={templateDraft.showPhotos} onChange={(event) => setTemplateDraft({ ...templateDraft, showPhotos: event.target.checked })} /> Mostrar fotos</label>
                          <label><input type="checkbox" checked={templateDraft.showDescriptions} onChange={(event) => setTemplateDraft({ ...templateDraft, showDescriptions: event.target.checked })} /> Descripciones</label>
                          <label><input type="checkbox" checked={templateDraft.showAllergens} onChange={(event) => setTemplateDraft({ ...templateDraft, showAllergens: event.target.checked })} /> Alérgenos</label>
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Fondo</h3>
                        <ImageUploader
                          label="Imagen de fondo (opcional)"
                          currentImageUrl={templateDraft.backgroundImageUrl}
                          onImageUploaded={(url) => setTemplateDraft({ ...templateDraft, backgroundImageUrl: url })}
                          onImageRemoved={() => setTemplateDraft({ ...templateDraft, backgroundImageUrl: '' })}
                        />

                        {templateDraft.backgroundImageUrl ? (
                          <label className={styles.opacityField}>
                            <span className={styles.opacityFieldLabel}>
                              Opacidad del fondo
                              <strong>{templateDraft.backgroundImageOpacity}%</strong>
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={templateDraft.backgroundImageOpacity}
                              onChange={(event) =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  backgroundImageOpacity: Number(event.target.value),
                                })
                              }
                              aria-label="Opacidad del fondo"
                            />
                          </label>
                        ) : null}
                      </section>
                    </div>

                    <div className={styles.designToolsFooter}>
                      <button type="button" className={styles.primaryBtn} onClick={() => void handleSaveTemplate()} disabled={saving}>
                        Guardar diseño
                      </button>
                    </div>
                  </aside>

                  <div className={styles.designCanvas} aria-label="Vista previa en vivo">
                    <div className={styles.designCanvasToolbar}>
                      <span className={styles.designCanvasLabel}>Vista previa móvil</span>
                      <span className={styles.designCanvasHint}>Así se verá en el teléfono del cliente</span>
                    </div>

                    <div className={styles.templateStrip}>
                      <span className={styles.templateStripLabel}>Plantillas</span>
                      <div className={styles.templateStripScroll} role="list" aria-label="Plantillas de carta">
                        {MENU_TEMPLATE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            role="listitem"
                            className={`${styles.templateChip} ${templateDraft.templateId === preset.id ? styles.templateChipActive : ''}`}
                            onClick={() => applyTemplatePreset(preset.id)}
                            title={preset.description}
                          >
                            <span className={styles.templateChipSwatch} style={{ background: preset.swatch }} />
                            <span className={styles.templateChipName}>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.designCanvasViewport}>
                      <div className={styles.phoneMockup} aria-label="Vista previa en teléfono">
                        <div className={styles.phoneMockupShell}>
                          <div className={styles.phoneMockupNotch} aria-hidden="true" />
                          <div className={styles.phoneMockupScreen}>
                            <MenuPreview
                              embedded
                              board={{ ...selectedBoard, name: boardNameDraft || selectedBoard.name, template: templateDraft }}
                              nodes={boardNodes}
                              restaurantName={company?.name}
                            />
                          </div>
                          <div className={styles.phoneMockupHome} aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {createBoardOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeCreateBoardModal}>
          <div
            className={`${styles.modal} ${styles.createBoardModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-board-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="create-board-title">Nueva carta</h3>
            <p className={styles.modalLead}>
              Cada carta es una categoría distinta: desayuno, comidas, cena, vinos…
            </p>

            <label>
              Nombre de la carta *
              <input
                value={newBoardName}
                onChange={(event) => setNewBoardName(event.target.value)}
                placeholder="Ej. Desayuno, Cena, Carta de vinos"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleCreateBoard()
                  }
                }}
              />
            </label>

            <div className={styles.suggestionRow}>
              {['Desayuno', 'Comidas', 'Cena', 'Vinos'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() => setNewBoardName(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {createBoardError ? <p className={styles.error}>{createBoardError}</p> : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancelBtn} onClick={closeCreateBoardModal} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalSecondaryBtn}
                onClick={() => {
                  closeCreateBoardModal()
                  openExcelImportModal('new-board')
                }}
                disabled={saving}
              >
                Crear desde Excel
              </button>
              <button type="button" className={styles.modalAcceptBtn} onClick={() => void handleCreateBoard()} disabled={saving}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nodeForm ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setNodeForm(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>
              {nodeForm.mode === 'edit' ? 'Editar' : 'Nuevo'}{' '}
              {nodeForm.nodeType === 'product'
                ? 'producto'
                : getParentFamilyName(nodeForm, boardNodes)
                  ? `subfamilia de ${getParentFamilyName(nodeForm, boardNodes)}`
                  : 'familia'}
            </h3>

            <label>
              Nombre *
              <input
                value={nodeForm.name}
                onChange={(event) => setNodeForm({ ...nodeForm, name: event.target.value })}
              />
            </label>

            {nodeForm.nodeType === 'family' ? (
              <div className={styles.availabilityField}>
                <label className={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={nodeForm.availabilityEnabled}
                    onChange={(event) =>
                      setNodeForm({ ...nodeForm, availabilityEnabled: event.target.checked })
                    }
                  />
                  Activar horario de disponibilidad
                </label>
                {nodeForm.availabilityEnabled ? (
                  <div className={styles.availabilityRow}>
                    <input
                      type="time"
                      value={nodeForm.availabilityStart}
                      onChange={(event) =>
                        setNodeForm({ ...nodeForm, availabilityStart: event.target.value })
                      }
                      aria-label="Hora de inicio"
                    />
                    <span aria-hidden="true">—</span>
                    <input
                      type="time"
                      value={nodeForm.availabilityEnd}
                      onChange={(event) =>
                        setNodeForm({ ...nodeForm, availabilityEnd: event.target.value })
                      }
                      aria-label="Hora de fin"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {nodeForm.nodeType === 'product' ? (
              <>
                <label>
                  Descripción
                  <textarea
                    rows={3}
                    value={nodeForm.description}
                    onChange={(event) => setNodeForm({ ...nodeForm, description: event.target.value })}
                  />
                </label>
                <div className={styles.priceField}>
                  <span className={styles.fieldLabel}>Precio</span>
                  <div className={styles.priceRow}>
                    <select
                      value={nodeForm.priceCurrency}
                      onChange={(event) =>
                        setNodeForm({ ...nodeForm, priceCurrency: event.target.value })
                      }
                      aria-label="Divisa"
                    >
                      {MENU_CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code} ({currency.symbol})
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      value={nodeForm.priceInput}
                      onChange={(event) =>
                        setNodeForm({
                          ...nodeForm,
                          priceInput: sanitizeMenuPriceInput(event.target.value),
                        })
                      }
                      placeholder="12,50"
                      aria-label="Importe"
                    />
                  </div>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Alérgenos</span>
                  <div className={styles.allergenGrid}>
                    {MENU_ALLERGEN_OPTIONS.map((allergen) => {
                      const selected = nodeForm.allergens.includes(allergen.id)

                      return (
                        <button
                          key={allergen.id}
                          type="button"
                          className={`${styles.allergenChip} ${selected ? styles.allergenChipActive : ''}`}
                          onClick={() => toggleAllergen(allergen.id)}
                          aria-pressed={selected}
                        >
                          <span className={styles.allergenIcon} aria-hidden="true">
                            {allergen.icon}
                          </span>
                          <span>{allergen.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <ImageUploader
                  label="Foto del producto"
                  currentImageUrl={nodeForm.photoUrl}
                  onImageUploaded={(url) => setNodeForm({ ...nodeForm, photoUrl: url })}
                  onImageRemoved={() => setNodeForm({ ...nodeForm, photoUrl: '' })}
                />
                <label className={styles.checkboxLine}>
                  <input
                    type="checkbox"
                    checked={nodeForm.active}
                    onChange={(event) => setNodeForm({ ...nodeForm, active: event.target.checked })}
                  />
                  Visible en la carta
                </label>
              </>
            ) : null}

            {nodeFormError ? <p className={styles.error}>{nodeFormError}</p> : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancelBtn} onClick={() => setNodeForm(null)}>
                Cancelar
              </button>
              <button type="button" className={styles.modalAcceptBtn} onClick={() => void saveNodeForm()} disabled={saving}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MenuExcelExportModal
        open={excelExportOpen}
        boardName={boardNameDraft || selectedBoard?.name || 'Carta'}
        nodes={boardNodes}
        onClose={() => setExcelExportOpen(false)}
      />

      <MenuExcelImportModal
        open={excelImportOpen}
        mode={excelImportMode}
        companyId={companyId}
        boardId={selectedBoardId}
        boardName={boardNameDraft || selectedBoard?.name || ''}
        existingBoardCount={boards.length}
        existingNodes={boardNodes}
        onClose={() => setExcelImportOpen(false)}
        onSuccess={(boardId) => void handleExcelImportSuccess(boardId)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteBoardTarget)}
        title="Eliminar carta"
        message={`¿Eliminar «${deleteBoardTarget?.name ?? ''}» y todos sus productos?`}
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDeleteBoard()}
        onCancel={() => setDeleteBoardTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteNodeTarget)}
        title="Eliminar elemento"
        message={`¿Eliminar «${deleteNodeTarget?.name ?? ''}»${deleteNodeTarget?.nodeType === 'family' ? ' y su contenido' : ''}?`}
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDeleteNode()}
        onCancel={() => setDeleteNodeTarget(null)}
      />

      {company && selectedBoard && selectedBoardPublicUrl ? (
        <QrCustomizerModal
          isOpen={menuQrCustomizerOpen}
          kind="menu"
          url={selectedBoardPublicUrl}
          filename={`qr-carta-${slugify(selectedBoard.name)}-${slugify(company.slug || company.name)}.png`}
          companyId={companyId}
          context={{
            companyName: company.name,
            companyLogoUrl: company.logoUrl,
            menuBoardName: selectedBoard.name,
          }}
          initialConfig={company.qrBranding.menu}
          onClose={() => setMenuQrCustomizerOpen(false)}
          onSaved={() => void refreshCompany()}
        />
      ) : null}
    </div>
  )
}

export default CompanyMenu
