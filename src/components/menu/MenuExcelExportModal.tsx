import { useEffect, useMemo, useState } from 'react'
import {
  buildMenuExcelExportRows,
  downloadMenuExcelFile,
  getMenuExcelExportGroups,
  getMenuExcelTemplateRows,
  sanitizeMenuExcelFileName,
} from '../../utils/menuExcelImport'
import type { MenuNode } from '../../types'
import styles from './MenuExcelExportModal.module.css'

interface MenuExcelExportModalProps {
  open: boolean
  boardName: string
  nodes: MenuNode[]
  onClose: () => void
}

function MenuExcelExportModal({ open, boardName, nodes, onClose }: MenuExcelExportModalProps) {
  const groups = useMemo(() => getMenuExcelExportGroups(nodes), [nodes])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSelectedGroupIds(groups.map((group) => group.id))
    }
  }, [open, groups])

  if (!open) {
    return null
  }

  const selectedProductIds = new Set(
    groups
      .filter((group) => selectedGroupIds.includes(group.id))
      .flatMap((group) => group.productIds),
  )

  const selectedProductCount = selectedProductIds.size
  const allSelected = groups.length > 0 && selectedGroupIds.length === groups.length

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    )
  }

  const toggleAll = () => {
    setSelectedGroupIds(allSelected ? [] : groups.map((group) => group.id))
  }

  const handleDownloadTemplate = () => {
    downloadMenuExcelFile('plantilla-carta.xlsx', getMenuExcelTemplateRows())
  }

  const handleDownloadSelection = () => {
    const rows = buildMenuExcelExportRows(nodes, selectedProductIds)
    const fileStem = sanitizeMenuExcelFileName(boardName || 'carta')
    downloadMenuExcelFile(`${fileStem}.xlsx`, rows)
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-excel-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="menu-excel-export-title">Descargar Excel</h3>

        <p className={styles.lead}>
          Descarga la carta en Excel, edítala y vuelve a importarla.
          Columnas:
          {' '}
          <strong>familia, nombre, descripcion, precio</strong>
          {' '}
          y una columna por alérgeno (
          <strong>GLUTEN, HUEVO, LACTOSA…</strong>
          ) con
          {' '}
          <strong>si</strong>
          {' '}
          o
          {' '}
          <strong>no</strong>
          .
        </p>

        <div className={styles.templateBox}>
          <div>
            <strong>Plantilla vacía</strong>
            <p>Con ejemplos y hoja de ayuda para empezar desde cero.</p>
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={handleDownloadTemplate}>
            Descargar plantilla
          </button>
        </div>

        {groups.length > 0 ? (
          <div className={styles.selectionBlock}>
            <div className={styles.selectionHead}>
              <strong>Incluir de «{boardName}»</strong>
              <button type="button" className={styles.linkBtn} onClick={toggleAll}>
                {allSelected ? 'Quitar todo' : 'Seleccionar todo'}
              </button>
            </div>

            <ul className={styles.groupList}>
              {groups.map((group) => (
                <li key={group.id}>
                  <label className={styles.groupItem}>
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                    />
                    <span className={styles.groupLabel}>{group.label}</span>
                    <span className={styles.groupCount}>
                      {group.productCount}
                      {' '}
                      {group.productCount === 1 ? 'producto' : 'productos'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <p className={styles.selectionHint}>
              Puedes editar el Excel, añadir filas nuevas con familias distintas e importarlo de nuevo.
              Las familias nuevas se crearán al importar.
            </p>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleDownloadSelection}
              disabled={selectedProductCount === 0}
            >
              Descargar
              {' '}
              {selectedProductCount}
              {' '}
              {selectedProductCount === 1 ? 'producto' : 'productos'}
            </button>
          </div>
        ) : (
          <p className={styles.emptyHint}>
            Esta carta aún no tiene productos. Descarga la plantilla, rellénala e impórtala.
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default MenuExcelExportModal
