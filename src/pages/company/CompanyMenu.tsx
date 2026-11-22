import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Info,
  LayoutGrid,
  LayoutList,
  Link2,
  Palette,
  Pencil,
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUploader from '../../components/ImageUploader'
import MenuExcelExportModal from '../../components/menu/MenuExcelExportModal'
import MenuExcelImportModal, { type MenuExcelImportMode } from '../../components/menu/MenuExcelImportModal'
import MenuPdfViewer from '../../components/menu/MenuPdfViewer'
import MenuPreview from '../../components/menu/MenuPreview'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import { parseCompanyPlanId } from '../../data/companyPlans'
import {
  clampMenuTemplateForPlan,
  menuBoardActivationBlockReason,
  planAllowsExcel,
  planAllowsMenuGrid,
  planAllowsMenuPdf,
  planAllowsMenuPhotos,
  planAllowsMoreThan,
  planMaxCount,
  planRequiredForCount,
  requiredPlanName,
} from '../../data/companyPlanLimits'
import { LockedControl, PlanLockHint } from '../../components/PlanLockHint'
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
import { hasMenuPdf, type MenuBoard, type MenuBoardInput, type MenuCategoryAvailability, type MenuNode, type MenuNodeInput, type MenuTemplateConfig } from '../../types'
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
import {
  formatFileSize,
  isAllowedPdfFile,
  isValidPdfFileSize,
  MAX_PDF_FILE_SIZE,
} from '../../constants/fileUpload'
import { uploadPdfToCloudinary } from '../../utils/cloudinaryUpload'
import styles from './CompanyMenu.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

interface CompanyMenuProps {
  companyId: string
}

type EditorTab = 'content' | 'design' | 'pdf'

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
    pdfUrl: board.pdfUrl,
    pdfFileName: board.pdfFileName,
    pdfPages: board.pdfPages,
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
  const demo = useCompanyDemo()
  const planId = parseCompanyPlanId(company?.planId)
  const [boards, setBoards] = useState<MenuBoard[]>([])
  const [nodes, setNodes] = useState<MenuNode[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [editorTab, setEditorTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boardNameDraft, setBoardNameDraft] = useState('')
  const [templateDraft, setTemplateDraft] = useState<MenuTemplateConfig>(defaultMenuTemplate())
  const pdfInputRef = useRef<HTMLInputElement>(null)
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

  const canAddMenu = planAllowsMoreThan(planId, 'menus', boards.length)
  const canUsePhotos = planAllowsMenuPhotos(planId)
  const canUseGrid = planAllowsMenuGrid(planId)
  const canUsePdf = planAllowsMenuPdf(planId)
  const canUseExcel = planAllowsExcel(planId)
  const nextMenuPlanName = requiredPlanName('menus', planRequiredForCount('menus', boards.length + 1))

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
    setTemplateDraft(clampMenuTemplateForPlan(selectedBoard.template, planId))
  }, [planId, selectedBoard])

  useEffect(() => {
    if (!canUsePdf && editorTab === 'pdf') {
      setEditorTab('content')
    }
  }, [canUsePdf, editorTab])

  const persistBoard = async (input: MenuBoardInput) => {
    if (!selectedBoard) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextInput = {
        ...input,
        template: clampMenuTemplateForPlan(input.template, planId),
      }
      await updateCompanyMenuBoard(companyId, selectedBoard.id, nextInput)
      setBoards((current) =>
        current.map((board) =>
          board.id === selectedBoard.id
            ? {
                ...board,
                ...nextInput,
                pdfUrl: nextInput.pdfUrl ?? board.pdfUrl,
                pdfFileName: nextInput.pdfFileName ?? board.pdfFileName,
                pdfPages: nextInput.pdfPages ?? board.pdfPages,
                updatedAt: new Date(),
              }
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

    if (!canAddMenu) {
      setCreateBoardError(`En tu plan puedes tener ${planMaxCount(planId, 'menus') === 1 ? '1 carta' : `hasta ${planMaxCount(planId, 'menus')} cartas`}. Pasa a ${nextMenuPlanName} para crear más.`)
      return
    }

    setSaving(true)
    setError(null)
    setCreateBoardError(null)

    try {
      const activeCount = boards.filter((board) => board.active).length
      const id = await createCompanyMenuBoard(companyId, {
        name,
        active: planMaxCount(planId, 'menus') == null || activeCount < (planMaxCount(planId, 'menus') ?? 0),
        sortOrder: boards.length,
        template: clampMenuTemplateForPlan(defaultMenuTemplate(), planId),
      })

      await loadMenu()
      setSelectedBoardId(id)
      setEditorTab('content')
      setCreateBoardOpen(false)
      setNewBoardName('')
    } catch (err) {
      setCreateBoardError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBoardActive = async (board: MenuBoard) => {
    if (!board.active) {
      const reason = menuBoardActivationBlockReason(board, boards, planId)
      if (reason) {
        setError(reason)
        return
      }
    }

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

    // La plantilla cambia colores y fuente; las opciones de estilo (subtítulo, barra de
    // categorías, buscador, forma de los platos…) se mantienen.
    setTemplateDraft((current) => clampMenuTemplateForPlan({
      ...preset.config,
      tagline: current.tagline,
      showCategoryNav: current.showCategoryNav,
      showSearch: current.showSearch,
      cardStyle: current.cardStyle,
      density: current.density,
      headerAlign: current.headerAlign,
      photoShape: current.photoShape,
    }, planId))
  }

  const handlePdfFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canUsePdf) {
      setError(`Subir un PDF está en el plan ${requiredPlanName('menu_pdf')}.`)
      event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !selectedBoard) {
      return
    }

    if (!isAllowedPdfFile(file)) {
      setError('Sube un archivo PDF.')
      return
    }

    if (!isValidPdfFileSize(file.size)) {
      setError(`El PDF no puede superar ${formatFileSize(MAX_PDF_FILE_SIZE)}.`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const uploaded = await uploadPdfToCloudinary(file)
      await persistBoard({
        ...boardToInput(selectedBoard),
        name: boardNameDraft.trim() || selectedBoard.name,
        pdfUrl: uploaded.url,
        pdfFileName: uploaded.fileName,
        pdfPages: uploaded.pages,
      })
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo subir el PDF.'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePdf = async () => {
    if (!selectedBoard) {
      return
    }

    await persistBoard({
      ...boardToInput(selectedBoard),
      name: boardNameDraft.trim() || selectedBoard.name,
      pdfUrl: '',
      pdfFileName: '',
      pdfPages: 0,
    })
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
      photoUrl: canUsePhotos || nodeForm.mode === 'edit' ? nodeForm.photoUrl : '',
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

  const countProducts = (node: MenuTreeNode): number =>
    node.children.reduce(
      (sum, child) => sum + (child.nodeType === 'product' ? 1 : countProducts(child)),
      0,
    )

  const renderTreeNode = (node: MenuTreeNode) => {
    const pathLabel = getNodePathLabel(node, boardNodes)
    const isFamily = node.nodeType === 'family'
    const isSubfamily = isFamily && Boolean(node.parentId)
    const productCount = isFamily ? countProducts(node) : 0

    return (
      <div key={node.id} className={styles.treeBlock}>
        <div
          className={[
            styles.treeRow,
            isFamily ? (isSubfamily ? styles.treeRowSubfamily : styles.treeRowFamily) : styles.treeRowProduct,
            node.nodeType === 'product' && !node.active ? styles.treeRowHidden : '',
            draggingNodeId === node.id ? styles.treeRowDragging : '',
            getTreeRowDropClass(node),
          ].filter(Boolean).join(' ')}
          style={{ "--depth": node.depth } as CSSProperties}
          draggable={!demo}
          onDragStart={() => setDraggingNodeId(node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => handleDragOverNode(event, node)}
          onDrop={(event) => handleDropOnNode(event, node)}
          onDoubleClick={() => {
            if (!demo) {
              openEditNode(node)
            }
          }}
        >
          {demo ? null : (
            <span className={styles.dragHandle} aria-hidden="true" title="Arrastra para mover">
              <GripVertical size={15} />
            </span>
          )}

          {isFamily ? (
            <span className={isSubfamily ? styles.subfamilyIcon : styles.familyIcon} aria-hidden="true">
              {isSubfamily ? <Folder size={15} /> : <FolderOpen size={16} />}
            </span>
          ) : (
            <span className={styles.productThumb} aria-hidden="true">
              {node.photoUrl ? (
                <img src={optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.photoPreview)} alt="" loading="lazy" />
              ) : (
                <UtensilsCrossed size={15} />
              )}
            </span>
          )}

          <div className={styles.treeMain}>
            <div className={styles.treeTitleRow}>
              <strong>{node.name || 'Sin nombre'}</strong>
              {isFamily ? (
                <span className={styles.countChip}>
                  {productCount} {productCount === 1 ? 'producto' : 'productos'}
                </span>
              ) : null}
              {isSubfamily ? <span className={styles.kindChip}>{getFamilyTypeLabel(node, boardNodes)}</span> : null}
              {isFamily && node.availability.enabled ? (
                <span className={styles.availabilityTag}>
                  <Clock size={12} aria-hidden="true" />
                  {formatMenuCategoryAvailability(node.availability)}
                </span>
              ) : null}
              {node.nodeType === 'product' && !node.active ? (
                <span className={styles.inactiveTag}>
                  <EyeOff size={12} aria-hidden="true" />
                  Oculto
                </span>
              ) : null}
            </div>
            {node.nodeType === 'product' && (node.description || (pathLabel && node.depth === 0)) ? (
              <p className={styles.treeDescription}>
                {node.description || pathLabel}
              </p>
            ) : null}
          </div>

          {node.nodeType === 'product' && node.allergens.length > 0 ? (
            <span
              className={styles.treeAllergens}
              aria-label={`Alérgenos: ${node.allergens.map(getMenuAllergenLabel).join(', ')}`}
            >
              {node.allergens.slice(0, 5).map((allergen) => (
                <span key={allergen} className={styles.treeAllergenIcon} title={getMenuAllergenLabel(allergen)}>
                  {getMenuAllergenIcon(allergen)}
                </span>
              ))}
              {node.allergens.length > 5 ? (
                <span className={styles.treeAllergenMore}>+{node.allergens.length - 5}</span>
              ) : null}
            </span>
          ) : null}

          {node.nodeType === 'product' ? (
            <span className={styles.treePrice}>
              {node.priceCents != null ? formatMenuPrice(node.priceCents, node.priceCurrency) : '—'}
            </span>
          ) : null}

          {demo ? null : (
            <div className={styles.treeActions}>
              {isFamily ? (
                <>
                  <button
                    type="button"
                    className={styles.treeIconBtn}
                    onClick={() => openCreateNode('product', node.id)}
                    title="Añadir producto"
                    aria-label={`Añadir producto a ${node.name}`}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.treeIconBtn}
                    onClick={() => openCreateNode('family', node.id)}
                    title="Añadir subfamilia"
                    aria-label={`Añadir subfamilia a ${node.name}`}
                  >
                    <FolderPlus size={15} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.treeIconBtn}
                  onClick={() => openCopyProduct(node)}
                  title="Duplicar"
                  aria-label={`Duplicar ${node.name}`}
                >
                  <Copy size={15} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className={styles.treeIconBtn}
                onClick={() => openEditNode(node)}
                title="Editar"
                aria-label={`Editar ${node.name}`}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.treeIconBtn} ${styles.dangerBtn}`}
                onClick={() => setDeleteNodeTarget(node)}
                title="Eliminar"
                aria-label={`Eliminar ${node.name}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {node.children.length > 0 ? (
          <div className={styles.treeChildren}>
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} aria-hidden="true" />
        Cargando carta…
      </div>
    )
  }

  const allProducts = nodes.filter((node) => node.nodeType === 'product')
  const visibleProducts = allProducts.filter((node) => node.active).length
  const productsWithPhoto = allProducts.filter((node) => node.photoUrl).length
  const activeBoardCount = boards.filter((board) => board.active).length
  const productsByBoard = new Map<string, number>()
  for (const node of allProducts) {
    productsByBoard.set(node.boardId, (productsByBoard.get(node.boardId) ?? 0) + 1)
  }
  const boardProductCount = productsByBoard.get(selectedBoardId ?? '') ?? 0
  const boardFamilyCount = boardNodes.filter((node) => node.nodeType === 'family').length
  const shareDisabled = !selectedBoard?.active || !selectedBoardPublicUrl
  const shareTitle = selectedBoard?.active ? undefined : 'Activa la carta para compartirla'
  const boardNameDirty = Boolean(selectedBoard) && boardNameDraft.trim() !== (selectedBoard?.name ?? '')

  const colorFields: { key: keyof MenuTemplateConfig; label: string }[] = [
    { key: 'backgroundColor', label: 'Fondo' },
    { key: 'titleColor', label: 'Títulos' },
    { key: 'textColor', label: 'Texto' },
    { key: 'accentColor', label: 'Acento' },
    { key: 'familyColor', label: 'Familias' },
    { key: 'subfamilyColor', label: 'Subfamilias' },
    { key: 'priceColor', label: 'Precios' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Carta</h2>
          <p className={styles.subtitle}>
            Crea cartas (desayuno, cena, vinos…), organiza familias y productos, elige el diseño o sube un PDF.
          </p>
        </div>
        <div className={styles.headerActions}>
          {demo ? null : (
            <>
              <LockedControl
                locked={!canUseExcel}
                feature="importar la carta desde Excel"
                capabilityId="excel"
              >
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => openExcelImportModal('new-board')}
                  disabled={saving}
                >
                  <FileSpreadsheet size={15} aria-hidden="true" />
                  Desde Excel
                </button>
              </LockedControl>
              <LockedControl
                locked={!canAddMenu}
                feature="crear más cartas"
                capabilityId="menus"
                requiredPlanId={planRequiredForCount('menus', boards.length + 1)}
              >
                <button type="button" className={styles.primaryBtn} onClick={openCreateBoardModal} disabled={saving}>
                  <Plus size={16} aria-hidden="true" />
                  Nueva carta
                </button>
              </LockedControl>
            </>
          )}
        </div>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Cartas activas</span>
          <span className={styles.kpiValue}>
            {activeBoardCount}
            <small>de {boards.length}</small>
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Productos visibles</span>
          <span className={styles.kpiValue}>
            {visibleProducts}
            <small>de {allProducts.length}</small>
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Familias</span>
          <span className={styles.kpiValue}>{nodes.filter((node) => node.nodeType === 'family').length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Con foto</span>
          <span className={styles.kpiValue}>
            {allProducts.length ? Math.round((productsWithPhoto / allProducts.length) * 100) : 0}
            <small>%</small>
          </span>
          <span className={styles.kpiBar} aria-hidden="true">
            <span style={{ width: `${allProducts.length ? (productsWithPhoto / allProducts.length) * 100 : 0}%` }} />
          </span>
        </div>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={`${styles.layout} ${editorTab === 'design' && selectedBoard ? styles.layoutDesign : ''}`}>
        <aside className={styles.boardSidebar} aria-label="Cartas">
          <div className={styles.boardSidebarHead}>
            <h3>Cartas</h3>
            <span className={styles.countChip}>{boards.length}</span>
          </div>
          {boards.length === 0 ? (
            <div className={styles.emptyHint}>
              <BookOpen size={20} aria-hidden="true" />
              <p>Aún no tienes cartas.</p>
              {demo ? null : (
                <button type="button" className={styles.secondaryBtn} onClick={openCreateBoardModal}>
                  Crear la primera
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.boardList}>
              {boards.map((board, index) => (
                <li key={board.id} className={styles.boardListItem}>
                  <button
                    type="button"
                    className={`${styles.boardItem} ${selectedBoardId === board.id ? styles.boardItemActive : ''}`}
                    onClick={() => setSelectedBoardId(board.id)}
                    aria-current={selectedBoardId === board.id ? 'true' : undefined}
                  >
                    <span className={styles.boardItemIcon} aria-hidden="true">
                      {hasMenuPdf(board) ? <FileText size={16} /> : <BookOpen size={16} />}
                    </span>
                    <span className={styles.boardItemText}>
                      <span className={styles.boardItemName}>{board.name}</span>
                      <span className={styles.boardItemMeta}>
                        <span className={board.active ? styles.dotOn : styles.dotOff} aria-hidden="true" />
                        {board.active ? 'Activa' : 'Inactiva'}
                        {' · '}
                        {hasMenuPdf(board)
                          ? 'PDF'
                          : `${productsByBoard.get(board.id) ?? 0} productos`}
                      </span>
                    </span>
                  </button>
                  {demo ? null : (
                    <div className={styles.boardItemActions}>
                      <button
                        type="button"
                        onClick={() => void handleMoveBoard(board.id, -1)}
                        disabled={index === 0 || saving}
                        aria-label={`Subir ${board.name}`}
                        title="Subir"
                      >
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMoveBoard(board.id, 1)}
                        disabled={index === boards.length - 1 || saving}
                        aria-label={`Bajar ${board.name}`}
                        title="Bajar"
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => setDeleteBoardTarget(board)}
                        aria-label={`Eliminar ${board.name}`}
                        title="Eliminar carta"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`${styles.editor} ${editorTab === 'design' ? styles.editorDesignMode : ''}`}>
          {!selectedBoard ? (
            <div className={styles.emptyEditor}>
              <BookOpen size={24} aria-hidden="true" />
              <p>Selecciona o crea una carta para empezar.</p>
            </div>
          ) : (
            <>
              <div className={styles.editorHead}>
                <div className={styles.editorTitleRow}>
                  <div className={styles.boardNameField}>
                    <label htmlFor="board-name" className={styles.srOnly}>Nombre de la carta</label>
                    <input
                      id="board-name"
                      className={styles.boardNameInput}
                      value={boardNameDraft}
                      onChange={(event) => setBoardNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && boardNameDirty) {
                          event.preventDefault()
                          void handleSaveBoardMeta()
                        }
                      }}
                      readOnly={demo}
                      title="Pulsa para cambiar el nombre"
                    />
                    {boardNameDirty && !demo ? (
                      <button
                        type="button"
                        className={styles.primaryBtnSmall}
                        onClick={() => void handleSaveBoardMeta()}
                        disabled={saving}
                      >
                        Guardar nombre
                      </button>
                    ) : (
                      <Pencil size={14} aria-hidden="true" className={styles.boardNameHint} />
                    )}
                  </div>

                  <div className={styles.editorHeadRight}>
                    {demo ? (
                      <span className={selectedBoard.active ? styles.statusOn : styles.statusOff}>
                        {selectedBoard.active ? 'Activa' : 'Inactiva'}
                      </span>
                    ) : (
                      <label className={styles.activeSwitch} title="Solo las cartas activas las ven los clientes">
                        <span className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={selectedBoard.active}
                            onChange={() => void handleToggleBoardActive(selectedBoard)}
                            disabled={saving}
                          />
                          <span aria-hidden="true" />
                        </span>
                        {selectedBoard.active ? 'Activa' : 'Inactiva'}
                      </label>
                    )}
                    <span className={styles.headDivider} aria-hidden="true" />
                    <div className={styles.shareGroup} role="group" aria-label="Compartir carta">
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={handleOpenMenuBoardPublic}
                        disabled={shareDisabled}
                        title={shareTitle ?? 'Ver la carta como cliente'}
                        aria-label="Ver la carta como cliente"
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${menuShareCopied ? styles.iconBtnDone : ''}`}
                        onClick={() => void handleCopyMenuBoardLink()}
                        disabled={shareDisabled}
                        title={shareTitle ?? (menuShareCopied ? 'Enlace copiado' : 'Copiar enlace')}
                        aria-label={menuShareCopied ? 'Enlace copiado' : 'Copiar enlace de la carta'}
                      >
                        {menuShareCopied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => setMenuQrCustomizerOpen(true)}
                        disabled={shareDisabled}
                        title={shareTitle ?? 'Personalizar QR'}
                        aria-label="Personalizar QR de la carta"
                      >
                        <Palette size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtnLabel}
                        onClick={() => void handleDownloadMenuBoardQr()}
                        disabled={shareDisabled || isDownloadingMenuQr}
                        title={shareTitle ?? 'Descargar el QR de la carta'}
                      >
                        <QrCode size={16} aria-hidden="true" />
                        {isDownloadingMenuQr ? 'Generando…' : 'QR'}
                      </button>
                    </div>
                  </div>
                </div>

                <p className={styles.editorMeta}>
                  {hasMenuPdf(selectedBoard)
                    ? `Se muestra el PDF «${selectedBoard.pdfFileName || 'Carta.pdf'}» · ${boardProductCount} productos para reseñas y promociones`
                    : `${boardFamilyCount} ${boardFamilyCount === 1 ? 'familia' : 'familias'} · ${boardProductCount} ${boardProductCount === 1 ? 'producto' : 'productos'}`}
                </p>

                <div className={styles.tabs} role="tablist" aria-label="Editor de la carta">
                  {(['content', 'design', 'pdf'] as EditorTab[]).map((tab) => {
                    const pdfLocked = tab === 'pdf' && !canUsePdf
                    const Icon = tab === 'content' ? LayoutList : tab === 'design' ? Palette : FileText
                    const tabButton = (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={editorTab === tab}
                        className={`${styles.tab} ${editorTab === tab ? styles.tabActive : ''}`}
                        onClick={() => setEditorTab(tab)}
                      >
                        <Icon size={15} aria-hidden="true" />
                        {tab === 'content' ? 'Productos' : tab === 'design' ? 'Diseño' : 'PDF'}
                        {tab === 'pdf' && hasMenuPdf(selectedBoard) ? <span className={styles.tabDot} aria-hidden="true" /> : null}
                      </button>
                    )

                    if (!pdfLocked) {
                      return tabButton
                    }

                    return (
                      <LockedControl
                        key={tab}
                        locked
                        feature="subir la carta en PDF"
                        capabilityId="menu_pdf"
                      >
                        {tabButton}
                      </LockedControl>
                    )
                  })}
                </div>
              </div>

              {editorTab === 'content' ? (
                <div className={styles.contentPanel}>
                  <div className={styles.contentToolbar}>
                    {demo ? null : (
                      <>
                        <button type="button" className={styles.primaryBtnSmall} onClick={() => openCreateNode('family', null)}>
                          <FolderPlus size={15} aria-hidden="true" />
                          Familia
                        </button>
                        <button type="button" className={styles.secondaryBtnSmall} onClick={() => openCreateNode('product', null)}>
                          <Plus size={15} aria-hidden="true" />
                          Producto suelto
                        </button>
                      </>
                    )}
                    <span className={styles.toolbarSpacer} />
                    <button type="button" className={styles.ghostBtn} onClick={() => setExcelExportOpen(true)}>
                      <Download size={15} aria-hidden="true" />
                      Exportar Excel
                    </button>
                    {demo ? null : (
                      <LockedControl
                        locked={!canUseExcel}
                        feature="importar la carta desde Excel"
                        capabilityId="excel"
                      >
                        <button type="button" className={styles.ghostBtn} onClick={() => openExcelImportModal('existing-board')}>
                          <Upload size={15} aria-hidden="true" />
                          Importar Excel
                        </button>
                      </LockedControl>
                    )}
                  </div>

                  {hasMenuPdf(selectedBoard) ? (
                    <p className={styles.infoNote}>
                      <Info size={14} aria-hidden="true" />
                      Esta carta muestra un PDF a los clientes. Estos productos siguen sirviendo para reseñas,
                      promociones y la vista previa.
                    </p>
                  ) : null}

                  {flatTree.length === 0 ? (
                    <div className={styles.emptyTree}>
                      <span className={styles.emptyTreeIcon} aria-hidden="true">
                        <UtensilsCrossed size={22} />
                      </span>
                      <p className={styles.emptyTreeTitle}>La carta está vacía</p>
                      <p>Empieza con una familia (Entrantes, Carnes, Postres…) y añade tus platos dentro.</p>
                      {demo ? null : (
                        <div className={styles.emptyTreeActions}>
                          <button type="button" className={styles.primaryBtnSmall} onClick={() => openCreateNode('family', null)}>
                            <FolderPlus size={15} aria-hidden="true" />
                            Crear familia
                          </button>
                          <LockedControl
                            locked={!canUseExcel}
                            feature="importar la carta desde Excel"
                            capabilityId="excel"
                          >
                            <button type="button" className={styles.secondaryBtnSmall} onClick={() => openExcelImportModal('existing-board')}>
                              <Upload size={15} aria-hidden="true" />
                              Importar Excel
                            </button>
                          </LockedControl>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.tree}>
                      {demo ? null : (
                        <div
                          className={[
                            styles.rootDropZone,
                            draggingNodeId ? styles.rootDropZoneVisible : '',
                            dropHint?.position === 'root' ? styles.rootDropZoneActive : '',
                          ].filter(Boolean).join(' ')}
                          onDragOver={handleDragOverRoot}
                          onDragLeave={() => setDropHint((current) => (current?.position === 'root' ? null : current))}
                          onDrop={handleDropOnRoot}
                        >
                          Suelta aquí para sacarlo de su familia
                        </div>
                      )}
                      {boardTree.map((node) => renderTreeNode(node))}
                    </div>
                  )}

                  {flatTree.length > 0 && !demo ? (
                    <p className={styles.treeFootnote}>
                      <GripVertical size={13} aria-hidden="true" />
                      Arrastra las filas para reordenar o cambiar de familia. Doble clic para editar.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {editorTab === 'design' && selectedBoard ? (
                <div className={styles.designWorkspace}>
                  <aside className={styles.designTools} aria-label="Herramientas de diseño">
                    <div className={styles.designToolsInner}>
                      <section className={styles.designSection}>
                        <h3>Plantilla</h3>
                        <div className={styles.templateGridSmall} role="list" aria-label="Plantillas de carta">
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
                      </section>

                      <section className={styles.designSection}>
                        <h3>Colores</h3>
                        <div className={styles.colorList}>
                          {colorFields.map((field) => (
                            <label key={field.key} className={styles.colorRow}>
                              <span>{field.label}</span>
                              <span className={styles.colorValue}>
                                <code>{String(templateDraft[field.key]).toUpperCase()}</code>
                                <input
                                  type="color"
                                  value={String(templateDraft[field.key])}
                                  onChange={(event) => setTemplateDraft({ ...templateDraft, [field.key]: event.target.value })}
                                  aria-label={`Color de ${field.label.toLowerCase()}`}
                                />
                              </span>
                            </label>
                          ))}
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Tipografía y disposición</h3>
                        <label className={styles.designField}>
                          <span>Fuente</span>
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
                        <div className={styles.lockedField}>
                          <div className={styles.designField}>
                            <span>Disposición</span>
                            <div className={styles.segmented} role="radiogroup" aria-label="Disposición de la carta">
                              {MENU_LAYOUT_OPTIONS.map((option) => {
                                const locked = option.id === 'grid' && !canUseGrid
                                const on = templateDraft.layout === option.id
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    disabled={locked}
                                    className={`${styles.segmentedButton} ${on ? styles.segmentedButtonOn : ''}`}
                                    onClick={() => setTemplateDraft({
                                      ...templateDraft,
                                      layout: option.id as MenuTemplateConfig['layout'],
                                    })}
                                  >
                                    {option.id === 'grid' ? <LayoutGrid size={14} aria-hidden="true" /> : <LayoutList size={14} aria-hidden="true" />}
                                    {option.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          {!canUseGrid ? (
                            <PlanLockHint feature="la disposición en cuadrícula" capabilityId="menu_photos" />
                          ) : null}
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Estilo de la carta</h3>
                        <label className={styles.designField}>
                          <span>Texto bajo el título</span>
                          <input
                            className={styles.designTextInput}
                            value={templateDraft.tagline ?? ''}
                            maxLength={80}
                            placeholder="Ej. Cocina de mercado desde 1998"
                            onChange={(event) => setTemplateDraft({ ...templateDraft, tagline: event.target.value })}
                          />
                        </label>
                        <div className={styles.designField}>
                          <span>Cabecera</span>
                          <div className={styles.segmented} role="radiogroup" aria-label="Alineación de la cabecera">
                            {([['center', 'Centrada'], ['left', 'A la izquierda']] as const).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={(templateDraft.headerAlign ?? 'center') === value}
                                className={`${styles.segmentedButton} ${(templateDraft.headerAlign ?? 'center') === value ? styles.segmentedButtonOn : ''}`}
                                onClick={() => setTemplateDraft({ ...templateDraft, headerAlign: value })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.designField}>
                          <span>Platos</span>
                          <div className={styles.segmented} role="radiogroup" aria-label="Aspecto de los platos">
                            {([['soft', 'Con fondo'], ['outline', 'Con borde'], ['plain', 'Sin caja']] as const).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={(templateDraft.cardStyle ?? 'soft') === value}
                                className={`${styles.segmentedButton} ${(templateDraft.cardStyle ?? 'soft') === value ? styles.segmentedButtonOn : ''}`}
                                onClick={() => setTemplateDraft({ ...templateDraft, cardStyle: value })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.designField}>
                          <span>Espaciado</span>
                          <div className={styles.segmented} role="radiogroup" aria-label="Espaciado">
                            {([['comfortable', 'Cómodo'], ['compact', 'Compacto']] as const).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={(templateDraft.density ?? 'comfortable') === value}
                                className={`${styles.segmentedButton} ${(templateDraft.density ?? 'comfortable') === value ? styles.segmentedButtonOn : ''}`}
                                onClick={() => setTemplateDraft({ ...templateDraft, density: value })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {templateDraft.layout === 'list' ? (
                          <div className={styles.designField}>
                            <span>Fotos en la lista</span>
                            <div className={styles.segmented} role="radiogroup" aria-label="Forma de las fotos">
                              {([['rounded', 'Redondeadas'], ['square', 'Cuadradas'], ['circle', 'Círculo']] as const).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  role="radio"
                                  aria-checked={(templateDraft.photoShape ?? 'rounded') === value}
                                  className={`${styles.segmentedButton} ${(templateDraft.photoShape ?? 'rounded') === value ? styles.segmentedButtonOn : ''}`}
                                  onClick={() => setTemplateDraft({ ...templateDraft, photoShape: value })}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </section>

                      <section className={styles.designSection}>
                        <h3>Ayudas para el cliente</h3>
                        <div className={styles.switchList}>
                          <label className={styles.switchRow}>
                            <span className={styles.switchText}>
                              <strong>Barra de categorías</strong>
                              <small>Fija arriba para saltar entre secciones</small>
                            </span>
                            <span className={styles.switch}>
                              <input
                                type="checkbox"
                                checked={templateDraft.showCategoryNav !== false}
                                onChange={(event) => setTemplateDraft({ ...templateDraft, showCategoryNav: event.target.checked })}
                              />
                              <span aria-hidden="true" />
                            </span>
                          </label>
                          <label className={styles.switchRow}>
                            <span className={styles.switchText}>
                              <strong>Buscador y alérgenos</strong>
                              <small>Buscar platos y ocultar los que lleven un alérgeno</small>
                            </span>
                            <span className={styles.switch}>
                              <input
                                type="checkbox"
                                checked={templateDraft.showSearch !== false}
                                onChange={(event) => setTemplateDraft({ ...templateDraft, showSearch: event.target.checked })}
                              />
                              <span aria-hidden="true" />
                            </span>
                          </label>
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Qué se muestra</h3>
                        <div className={styles.switchList}>
                          <div className={styles.lockedField}>
                            <label className={styles.switchRow}>
                              <span>Fotos de los platos</span>
                              <span className={styles.switch}>
                                <input
                                  type="checkbox"
                                  checked={templateDraft.showPhotos}
                                  disabled={!canUsePhotos}
                                  onChange={(event) => {
                                    if (!canUsePhotos) {
                                      return
                                    }
                                    setTemplateDraft({ ...templateDraft, showPhotos: event.target.checked })
                                  }}
                                />
                                <span aria-hidden="true" />
                              </span>
                            </label>
                            {!canUsePhotos ? (
                              <PlanLockHint feature="fotos en los platos" capabilityId="menu_photos" />
                            ) : null}
                          </div>
                          <label className={styles.switchRow}>
                            <span>Descripciones</span>
                            <span className={styles.switch}>
                              <input
                                type="checkbox"
                                checked={templateDraft.showDescriptions}
                                onChange={(event) => setTemplateDraft({ ...templateDraft, showDescriptions: event.target.checked })}
                              />
                              <span aria-hidden="true" />
                            </span>
                          </label>
                          <label className={styles.switchRow}>
                            <span>Alérgenos</span>
                            <span className={styles.switch}>
                              <input
                                type="checkbox"
                                checked={templateDraft.showAllergens}
                                onChange={(event) => setTemplateDraft({ ...templateDraft, showAllergens: event.target.checked })}
                              />
                              <span aria-hidden="true" />
                            </span>
                          </label>
                        </div>
                      </section>

                      <section className={styles.designSection}>
                        <h3>Imagen de fondo</h3>
                        <ImageUploader
                          label="Imagen de fondo (opcional)"
                          currentImageUrl={templateDraft.backgroundImageUrl}
                          onImageUploaded={(url) => setTemplateDraft({ ...templateDraft, backgroundImageUrl: url })}
                          onImageRemoved={() => setTemplateDraft({ ...templateDraft, backgroundImageUrl: '' })}
                        />

                        {templateDraft.backgroundImageUrl ? (
                          <label className={styles.opacityField}>
                            <span className={styles.opacityFieldLabel}>
                              Opacidad
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

                    {demo ? null : (
                      <div className={styles.designToolsFooter}>
                        <button type="button" className={styles.primaryBtn} onClick={() => void handleSaveTemplate()} disabled={saving}>
                          {saving ? 'Guardando…' : 'Guardar diseño'}
                        </button>
                      </div>
                    )}
                  </aside>

                  <div className={styles.designCanvas} aria-label="Vista previa en vivo">
                    <div className={styles.designCanvasToolbar}>
                      <span className={styles.designCanvasLabel}>
                        <Smartphone size={14} aria-hidden="true" />
                        Vista previa
                      </span>
                      <span className={styles.designCanvasHint}>
                        {hasMenuPdf(selectedBoard)
                          ? 'Los clientes verán el PDF; esto es la carta de productos.'
                          : 'Así se verá en el móvil del cliente. Los cambios se ven al momento.'}
                      </span>
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

              {editorTab === 'pdf' && selectedBoard ? (
                <div className={styles.pdfPanel}>
                  <input
                    ref={pdfInputRef}
                    className={styles.hiddenFileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => void handlePdfFile(event)}
                  />

                  {hasMenuPdf(selectedBoard) ? (
                    <>
                      <div className={styles.pdfFileCard}>
                        <span className={styles.pdfFileIcon} aria-hidden="true">
                          <FileText size={20} />
                        </span>
                        <span className={styles.pdfFileText}>
                          <strong>{selectedBoard.pdfFileName || 'Carta.pdf'}</strong>
                          <span>
                            {selectedBoard.pdfPages > 0
                              ? `${selectedBoard.pdfPages} página${selectedBoard.pdfPages === 1 ? '' : 's'} · `
                              : ''}
                            Es lo que ven los clientes al abrir esta carta
                          </span>
                        </span>
                        {demo ? null : (
                          <div className={styles.pdfFileActions}>
                            <button
                              type="button"
                              className={styles.secondaryBtnSmall}
                              onClick={() => pdfInputRef.current?.click()}
                              disabled={saving}
                            >
                              <Upload size={15} aria-hidden="true" />
                              {saving ? 'Subiendo…' : 'Reemplazar'}
                            </button>
                            <button
                              type="button"
                              className={`${styles.ghostBtn} ${styles.dangerBtn}`}
                              onClick={() => void handleRemovePdf()}
                              disabled={saving}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              Quitar
                            </button>
                          </div>
                        )}
                      </div>
                      <MenuPdfViewer
                        pdfUrl={selectedBoard.pdfUrl}
                        pdfPages={selectedBoard.pdfPages}
                        fileName={selectedBoard.pdfFileName}
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.pdfDropzone}
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={saving || demo}
                    >
                      <span className={styles.pdfDropzoneIcon} aria-hidden="true">
                        <Upload size={22} />
                      </span>
                      <strong>{saving ? 'Subiendo PDF…' : 'Sube tu carta en PDF'}</strong>
                      <span>
                        Los clientes verán exactamente ese documento. Máximo {formatFileSize(MAX_PDF_FILE_SIZE)}.
                      </span>
                    </button>
                  )}
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
            <header className={styles.modalHead}>
              <div>
                <h3 id="create-board-title">Nueva carta</h3>
                <p className={styles.modalLead}>Cada carta es una categoría: desayuno, comidas, cena, vinos…</p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={closeCreateBoardModal} aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nombre de la carta</span>
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
                {['Desayuno', 'Comidas', 'Cena', 'Postres', 'Vinos', 'Cócteles'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`${styles.suggestionChip} ${newBoardName === suggestion ? styles.suggestionChipOn : ''}`}
                    onClick={() => setNewBoardName(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {createBoardError ? <p className={styles.formError}>{createBoardError}</p> : null}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  closeCreateBoardModal()
                  openExcelImportModal('new-board')
                }}
                disabled={saving}
              >
                <FileSpreadsheet size={15} aria-hidden="true" />
                Crear desde Excel
              </button>
              <span className={styles.toolbarSpacer} />
              <button type="button" className={styles.secondaryBtn} onClick={closeCreateBoardModal} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => void handleCreateBoard()} disabled={saving}>
                {saving ? 'Creando…' : 'Crear carta'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nodeForm ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setNodeForm(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-form-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHead}>
              <div>
                <h3 id="node-form-title">
                  {nodeForm.mode === 'edit' ? 'Editar' : 'Nuevo'}{' '}
                  {nodeForm.nodeType === 'product'
                    ? 'producto'
                    : getParentFamilyName(nodeForm, boardNodes)
                      ? `subfamilia de ${getParentFamilyName(nodeForm, boardNodes)}`
                      : 'familia'}
                </h3>
                <p className={styles.modalLead}>
                  {nodeForm.nodeType === 'product'
                    ? 'Lo que verán tus clientes en la carta.'
                    : 'Agrupa productos: Entrantes, Carnes, Postres…'}
                </p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setNodeForm(null)} aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nombre</span>
                <input
                  value={nodeForm.name}
                  onChange={(event) => setNodeForm({ ...nodeForm, name: event.target.value })}
                  placeholder={nodeForm.nodeType === 'product' ? 'Ej. Croquetas de jamón' : 'Ej. Entrantes'}
                  autoFocus
                />
              </label>

              {nodeForm.nodeType === 'family' ? (
                <div className={styles.optionCard}>
                  <label className={styles.switchRow}>
                    <span className={styles.switchText}>
                      <strong>Horario de disponibilidad</strong>
                      <small>Por ejemplo, desayunos solo hasta las 12:00.</small>
                    </span>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={nodeForm.availabilityEnabled}
                        onChange={(event) =>
                          setNodeForm({ ...nodeForm, availabilityEnabled: event.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                  {nodeForm.availabilityEnabled ? (
                    <div className={styles.availabilityRow}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Desde</span>
                        <input
                          type="time"
                          value={nodeForm.availabilityStart}
                          onChange={(event) =>
                            setNodeForm({ ...nodeForm, availabilityStart: event.target.value })
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Hasta</span>
                        <input
                          type="time"
                          value={nodeForm.availabilityEnd}
                          onChange={(event) =>
                            setNodeForm({ ...nodeForm, availabilityEnd: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {nodeForm.nodeType === 'product' ? (
                <>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Descripción</span>
                    <textarea
                      rows={3}
                      value={nodeForm.description}
                      onChange={(event) => setNodeForm({ ...nodeForm, description: event.target.value })}
                      placeholder="Ingredientes, cómo se prepara, para cuántos es…"
                    />
                  </label>

                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Precio</span>
                    <div className={styles.priceRow}>
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
                      <select
                        value={nodeForm.priceCurrency}
                        onChange={(event) =>
                          setNodeForm({ ...nodeForm, priceCurrency: event.target.value })
                        }
                        aria-label="Divisa"
                      >
                        {MENU_CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.fieldLabelRow}>
                      <span className={styles.fieldLabel}>Alérgenos</span>
                      <span className={styles.fieldCounter}>
                        {nodeForm.allergens.length ? `${nodeForm.allergens.length} marcados` : 'Ninguno'}
                      </span>
                    </span>
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

                  {canUsePhotos ? (
                    <div className={styles.field}>
                      <ImageUploader
                        label="Foto del producto"
                        currentImageUrl={nodeForm.photoUrl}
                        onImageUploaded={(url) => setNodeForm({ ...nodeForm, photoUrl: url })}
                        onImageRemoved={() => setNodeForm({ ...nodeForm, photoUrl: '' })}
                      />
                    </div>
                  ) : (
                    <div className={styles.lockedField}>
                      <p className={styles.lockedHint}>Foto del producto</p>
                      <PlanLockHint feature="añadir imágenes a los productos" capabilityId="menu_photos" />
                    </div>
                  )}
                </>
              ) : null}

              {nodeFormError ? <p className={styles.formError}>{nodeFormError}</p> : null}
            </div>

            <div className={styles.modalActions}>
              {nodeForm.nodeType === 'product' ? (
                <label className={styles.activeSwitch}>
                  <span className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={nodeForm.active}
                      onChange={(event) => setNodeForm({ ...nodeForm, active: event.target.checked })}
                    />
                    <span aria-hidden="true" />
                  </span>
                  {nodeForm.active ? 'Visible en la carta' : 'Oculto en la carta'}
                </label>
              ) : null}
              <span className={styles.toolbarSpacer} />
              <button type="button" className={styles.secondaryBtn} onClick={() => setNodeForm(null)}>
                Cancelar
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => void saveNodeForm()} disabled={saving}>
                {saving ? 'Guardando…' : nodeForm.mode === 'edit' ? 'Guardar cambios' : 'Crear'}
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
