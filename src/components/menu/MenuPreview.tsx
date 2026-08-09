import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { MenuBoard, MenuNode, MenuTemplateConfig } from '../../types/company'
import { getMenuAllergenIcon, getMenuAllergenLabel } from '../../data/menuAllergens'
import { buildMenuTree, formatMenuPrice, type MenuTreeNode } from '../../utils/menuTree'
import {
  formatMenuCategoryAvailability,
  isMenuCategoryAvailable,
} from '../../utils/menuCategoryAvailability'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './MenuPreview.module.css'

interface MenuPreviewProps {
  board: MenuBoard
  nodes: MenuNode[]
  restaurantName?: string
  embedded?: boolean
  fullscreen?: boolean
}

function renderProductRow(products: MenuTreeNode[], template: MenuTemplateConfig) {
  const items = products
    .map((product) => renderProduct(product, template))
    .filter(Boolean)

  if (items.length === 0) {
    return null
  }

  if (template.layout === 'grid') {
    return (
      <div className={styles.layoutGridTrack}>
        <div className={styles.layoutGridScroll}>{items}</div>
      </div>
    )
  }

  return <div className={styles.layoutList}>{items}</div>
}

function renderFamily(
  node: MenuTreeNode,
  template: MenuTemplateConfig,
) {
  const isSubfamily = Boolean(node.parentId)
  const childFamilies = node.children.filter((child) => child.nodeType === 'family')
  const childProducts = node.children.filter((child) => child.nodeType === 'product')
  const availabilityLabel = formatMenuCategoryAvailability(node.availability)
  const isAvailable = isMenuCategoryAvailable(node.availability)

  return (
    <section
      key={node.id}
      className={`${styles.familyBlock} ${isSubfamily ? styles.familyBlockSub : ''} ${
        node.availability.enabled && !isAvailable ? styles.familyBlockUnavailable : ''
      }`}
      style={{ marginLeft: `${node.depth * 0.85}rem` }}
    >
      <div className={styles.familyHeading}>
        <h3 className={isSubfamily ? styles.subfamilyTitle : styles.familyTitle}>{node.name}</h3>
        {availabilityLabel ? (
          <span className={styles.familyAvailability}>{availabilityLabel}</span>
        ) : null}
      </div>
      {childFamilies.map((child) => renderFamily(child, template))}
      {node.availability.enabled && !isAvailable ? (
        <p className={styles.familyUnavailableNote}>
          Fuera de horario. Disponible {availabilityLabel}.
        </p>
      ) : null}
      {isAvailable && childProducts.length > 0 ? renderProductRow(childProducts, template) : null}
    </section>
  )
}

function ProductPhotoLightbox({
  name,
  imageUrl,
  onClose,
}: {
  name: string
  imageUrl: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className={styles.photoLightbox}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${name}`}
    >
      <div
        className={styles.photoLightboxPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.photoLightboxHeader}>
          <p className={styles.photoLightboxTitle}>{name}</p>
          <button
            type="button"
            className={styles.photoLightboxClose}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <img
          src={imageUrl}
          alt={name}
          className={styles.photoLightboxImage}
        />
      </div>
    </div>,
    document.body,
  )
}

function ListAllergenIcons({ allergens }: { allergens: string[] }) {
  const [activeAllergen, setActiveAllergen] = useState<string | null>(null)

  return (
    <div className={styles.listAllergens}>
      {allergens.map((allergen) => {
        const isActive = activeAllergen === allergen
        const label = getMenuAllergenLabel(allergen)

        return (
          <button
            key={allergen}
            type="button"
            className={`${styles.listAllergenBtn} ${isActive ? styles.listAllergenBtnActive : ''}`}
            onClick={() => setActiveAllergen(isActive ? null : allergen)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
          >
            <span className={styles.listAllergenIcon} aria-hidden="true">
              {getMenuAllergenIcon(allergen)}
            </span>
            {isActive ? <span className={styles.listAllergenLabel}>{label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function AllergenTooltipIcons({ allergens }: { allergens: string[] }) {
  const [activeAllergen, setActiveAllergen] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAllergen) {
      return undefined
    }

    const timer = window.setTimeout(() => setActiveAllergen(null), 2200)
    return () => window.clearTimeout(timer)
  }, [activeAllergen])

  return (
    <div className={styles.gridAllergens}>
      {allergens.map((allergen) => {
        const label = getMenuAllergenLabel(allergen)
        const isActive = activeAllergen === allergen

        return (
          <div key={allergen} className={styles.gridAllergenWrap}>
            <button
              type="button"
              className={`${styles.gridAllergenBtn} ${isActive ? styles.gridAllergenBtnActive : ''}`}
              onClick={() => setActiveAllergen(isActive ? null : allergen)}
              aria-label={label}
            >
              <span className={styles.gridAllergenIcon} aria-hidden="true">
                {getMenuAllergenIcon(allergen)}
              </span>
            </button>
            {isActive ? (
              <span className={styles.allergenTooltip} role="tooltip">
                {label}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function MenuGridProduct({
  node,
  template,
}: {
  node: MenuTreeNode
  template: MenuTemplateConfig
}) {
  const image = node.photoUrl
    ? optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductGrid)
    : ''

  const hasPhoto = Boolean(node.photoUrl?.trim())
  const showPhoto = template.showPhotos && hasPhoto && Boolean(image)
  const priceLabel = node.priceCents != null
    ? formatMenuPrice(node.priceCents, node.priceCurrency)
    : null

  return (
    <article className={styles.productCard}>
      {showPhoto ? (
        <img
          src={image}
          alt=""
          className={`${styles.productPhoto} ${styles.productPhotoGrid}`}
        />
      ) : null}
      <div className={styles.productGridBody}>
        <h4 className={styles.productGridTitle}>{node.name}</h4>
        {template.showDescriptions && node.description ? (
          <p className={styles.productDescription}>{node.description}</p>
        ) : null}
        <div className={styles.productGridFooter}>
          {template.showAllergens && node.allergens.length > 0 ? (
            <AllergenTooltipIcons allergens={node.allergens} />
          ) : null}
          {priceLabel ? (
            <span className={styles.productGridPrice}>{priceLabel}</span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function MenuListProduct({
  node,
  template,
}: {
  node: MenuTreeNode
  template: MenuTemplateConfig
}) {
  const [photoOpen, setPhotoOpen] = useState(false)

  const lightboxImage = node.photoUrl
    ? optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductLightbox)
    : ''
  const hasPhoto = Boolean(node.photoUrl?.trim())
  const priceLabel = node.priceCents != null
    ? formatMenuPrice(node.priceCents, node.priceCurrency)
    : null

  const cameraIcon = (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6.2 3.5h3.6l.85 1.75H13c.83 0 1.5.67 1.5 1.5v5.75c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5V6.75c0-.83.67-1.5 1.5-1.5h2.35L6.2 3.5zM8 6.35a2.65 2.65 0 100 5.3 2.65 2.65 0 000-5.3zm0 1.25a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8z"
        fill="currentColor"
      />
    </svg>
  )

  const photoControl = hasPhoto ? (
    <button
      type="button"
      className={`${styles.productPhotoBtn} ${styles.productPhotoBtnActive}`}
      onClick={() => setPhotoOpen(true)}
      title="Ver foto"
      aria-label={`Ver foto de ${node.name}`}
    >
      {cameraIcon}
    </button>
  ) : (
    <span
      className={`${styles.productPhotoBtn} ${styles.productPhotoBtnEmpty}`}
      title="Sin foto"
      aria-label="Sin foto"
    >
      {cameraIcon}
    </span>
  )

  return (
    <>
      <article key={node.id} className={styles.productCard}>
        <div className={styles.productListRow}>
          <div className={styles.productPhotoCol}>{photoControl}</div>
          <div className={styles.productMain}>
            <h4 className={styles.productTitleRow}>
              <span>{node.name}</span>
            </h4>
            {template.showDescriptions && node.description ? (
              <p className={styles.productDescription}>{node.description}</p>
            ) : null}
          </div>
          <div className={styles.productAside}>
            {priceLabel ? (
              <span className={styles.productPrice}>{priceLabel}</span>
            ) : null}
            {template.showAllergens && node.allergens.length > 0 ? (
              <ListAllergenIcons allergens={node.allergens} />
            ) : null}
          </div>
        </div>
      </article>
      {photoOpen && hasPhoto ? (
        <ProductPhotoLightbox
          name={node.name}
          imageUrl={lightboxImage}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </>
  )
}

function renderProduct(node: MenuTreeNode, template: MenuTemplateConfig) {
  if (!node.active) {
    return null
  }

  if (template.layout === 'list') {
    return <MenuListProduct key={node.id} node={node} template={template} />
  }

  return <MenuGridProduct key={node.id} node={node} template={template} />
}

function MenuPreview({ board, nodes, restaurantName, embedded = false, fullscreen = false }: MenuPreviewProps) {
  const template = board.template
  const tree = buildMenuTree(nodes.filter((node) => node.boardId === board.id))

  const rootProducts = tree.filter((node) => node.nodeType === 'product')
  const rootFamilies = tree.filter((node) => node.nodeType === 'family')

  const themeStyle = {
    '--menu-bg': template.backgroundColor,
    '--menu-title': template.titleColor,
    '--menu-text': template.textColor,
    '--menu-accent': template.accentColor,
    '--menu-family': template.familyColor,
    '--menu-subfamily': template.subfamilyColor,
    '--menu-price': template.priceColor,
    '--menu-font': template.fontFamily,
    '--menu-bg-image-opacity': String(template.backgroundImageOpacity / 100),
  } as CSSProperties

  return (
    <div
      className={`${styles.preview} ${embedded ? styles.previewEmbedded : ''} ${
        fullscreen ? styles.previewFullscreen : ''
      } ${
        template.layout === 'list' ? styles.previewListLayout : ''
      } ${template.layout === 'grid' ? styles.previewGridLayout : ''}`}
      style={themeStyle}
    >
      {template.backgroundImageUrl ? (
        <img src={template.backgroundImageUrl} alt="" className={styles.bgImage} />
      ) : null}
      <div className={styles.previewInner}>
        <header className={styles.previewHeader}>
          {restaurantName ? <p className={styles.restaurantName}>{restaurantName}</p> : null}
          <h2>{board.name}</h2>
        </header>

        {rootFamilies.map((family) => renderFamily(family, template))}

        {rootProducts.length > 0 ? renderProductRow(rootProducts, template) : null}

        {rootFamilies.length === 0 && rootProducts.length === 0 ? (
          <p className={styles.empty}>Añade familias o productos para ver la carta.</p>
        ) : null}
      </div>
    </div>
  )
}

export default MenuPreview
