import { useMemo, useRef, useState } from 'react'
import { DEFAULT_MENU_CURRENCY } from '../../data/menuCurrencies'
import { getMenuAllergenIcon, getMenuAllergenLabel } from '../../data/menuAllergens'
import { defaultMenuTemplate } from '../../data/menuTemplates'
import { createCompanyMenuBoard, createCompanyMenuNodesBatch } from '../../services/companyMenu'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { MenuNode } from '../../types'
import {
  buildMenuImportNodes,
  downloadMenuExcelFile,
  getMenuExcelTemplateRows,
  readMenuExcelFile,
  type MenuExcelRow,
} from '../../utils/menuExcelImport'
import { formatMenuPrice } from '../../utils/menuTree'
import styles from './MenuExcelImportModal.module.css'

export type MenuExcelImportMode = 'new-board' | 'existing-board'

interface MenuExcelImportModalProps {
  open: boolean
  mode: MenuExcelImportMode
  companyId: string
  boardId?: string | null
  boardName?: string
  existingBoardCount: number
  existingNodes?: MenuNode[]
  onClose: () => void
  onSuccess: (boardId: string) => void
}

function MenuExcelImportModal({
  open,
  mode,
  companyId,
  boardId,
  boardName = '',
  existingBoardCount,
  existingNodes = [],
  onClose,
  onSuccess,
}: MenuExcelImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cartName, setCartName] = useState(boardName)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<MenuExcelRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const previewSummary = useMemo(() => {
    const families = new Set(
      rows
        .map((row) => row.family.trim())
        .filter(Boolean),
    )

    return {
      products: rows.length,
      families: families.size,
      warnings: rows.reduce((count, row) => count + row.warnings.length, 0),
    }
  }, [rows])

  if (!open) {
    return null
  }

  const resetFileState = () => {
    setFileName('')
    setRows([])
    setParseErrors([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (saving) {
      return
    }

    resetFileState()
    onClose()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError(null)
    setParseErrors([])
    setRows([])
    setFileName(file.name)

    try {
      const result = await readMenuExcelFile(file)
      setRows(result.validRows)
      setParseErrors(result.errors)

      if (result.validRows.length === 0 && result.errors.length === 0) {
        setError('No se encontraron productos en el archivo.')
      }
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    }
  }

  const handleDownloadTemplate = () => {
    downloadMenuExcelFile('plantilla-carta.xlsx', getMenuExcelTemplateRows())
  }

  const handleImport = async () => {
    if (rows.length === 0) {
      setError('Selecciona un archivo Excel con al menos un producto.')
      return
    }

    const targetBoardName = mode === 'new-board' ? cartName.trim() : boardName.trim()

    if (mode === 'new-board' && !targetBoardName) {
      setError('Indica un nombre para la carta.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let targetBoardId = boardId ?? null

      if (mode === 'new-board') {
        targetBoardId = await createCompanyMenuBoard(companyId, {
          name: targetBoardName,
          active: true,
          sortOrder: existingBoardCount,
          template: defaultMenuTemplate(),
        })
      }

      if (!targetBoardId) {
        setError('No se pudo determinar la carta de destino.')
        return
      }

      const importNodes = buildMenuImportNodes(
        rows,
        targetBoardId,
        mode === 'existing-board' ? existingNodes : [],
        DEFAULT_MENU_CURRENCY,
      )

      await createCompanyMenuNodesBatch(companyId, importNodes)
      resetFileState()
      onSuccess(targetBoardId)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-excel-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="menu-excel-import-title">
          {mode === 'new-board' ? 'Crear carta desde Excel' : 'Importar Excel a la carta'}
        </h3>

        <p className={styles.lead}>
          La primera fila debe ser la cabecera. Columnas:
          {' '}
          <strong>familia</strong>
          {' '}
          (opcional),
          {' '}
          <strong>nombre</strong>
          ,
          {' '}
          <strong>descripcion</strong>
          ,
          {' '}
          <strong>precio</strong>
          ,
          {' '}
          y columnas de alérgenos (
          <strong>GLUTEN, HUEVO, LACTOSA…</strong>
          ) con
          {' '}
          <strong>si</strong>
          {' '}
          o
          {' '}
          <strong>no</strong>
          .
          {' '}
          Familia vacía = producto suelto. Usa
          {' '}
          <code>Carnes &gt; Vacuno</code>
          {' '}
          para subfamilias.
        </p>

        <div className={styles.hintBox}>
          <strong>Alérgenos:</strong>
          {' '}
          cada alérgeno tiene su columna (
          <code>GLUTEN</code>
          ,
          {' '}
          <code>HUEVO</code>
          …). Escribe
          {' '}
          <code>si</code>
          {' '}
          o
          {' '}
          <code>no</code>
          {' '}
          en cada una. Vacío = no. No se importan fotos.
        </div>

        <div className={styles.templateBox}>
          <div>
            <strong>Plantilla Excel</strong>
            <p>Descárgala, rellénala con tus productos e impórtala aquí.</p>
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={handleDownloadTemplate}>
            Descargar plantilla
          </button>
        </div>

        {mode === 'new-board' ? (
          <label>
            Nombre de la carta *
            <input
              value={cartName}
              onChange={(event) => setCartName(event.target.value)}
              placeholder="Ej. Cena, Desayuno, Carta de vinos"
            />
          </label>
        ) : (
          <p className={styles.targetBoard}>
            Carta destino:
            {' '}
            <strong>{boardName}</strong>
          </p>
        )}

        <label className={styles.fileField}>
          Archivo Excel (.xlsx, .xls, .csv)
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={(event) => void handleFileChange(event)}
          />
        </label>

        {fileName ? (
          <p className={styles.fileName}>
            Archivo:
            {' '}
            {fileName}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className={styles.previewBlock}>
            <div className={styles.previewHead}>
              <strong>Vista previa</strong>
              <span>
                {previewSummary.products}
                {' '}
                productos ·
                {' '}
                {previewSummary.families}
                {' '}
                familias
                {previewSummary.warnings > 0 ? ` · ${previewSummary.warnings} avisos` : ''}
              </span>
            </div>

            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Familia</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Alérgenos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 12).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.family || '—'}</td>
                      <td>
                        <div>{row.name}</div>
                        {row.description ? (
                          <span className={styles.previewDescription}>{row.description}</span>
                        ) : null}
                        {row.warnings.map((warning) => (
                          <span key={warning} className={styles.previewWarning}>{warning}</span>
                        ))}
                      </td>
                      <td>
                        {row.priceCents != null
                          ? formatMenuPrice(row.priceCents, DEFAULT_MENU_CURRENCY)
                          : '—'}
                      </td>
                      <td>
                        {row.allergens.length > 0 ? (
                          <span className={styles.previewAllergens}>
                            {row.allergens.map((allergen) => (
                              <span key={allergen} title={getMenuAllergenLabel(allergen)}>
                                {getMenuAllergenIcon(allergen)}
                              </span>
                            ))}
                          </span>
                        ) : (
                          'No'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 12 ? (
              <p className={styles.previewMore}>
                y
                {' '}
                {rows.length - 12}
                {' '}
                filas más…
              </p>
            ) : null}
          </div>
        ) : null}

        {parseErrors.length > 0 ? (
          <ul className={styles.parseErrors}>
            {parseErrors.slice(0, 6).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={handleClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={() => void handleImport()}
            disabled={saving || rows.length === 0}
          >
            {saving ? 'Importando…' : mode === 'new-board' ? 'Crear carta' : 'Importar productos'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MenuExcelImportModal
