import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MenuBoard, MenuNode, MenuTemplateConfig } from '../../types/company'
import { getMenuAllergenIcon, getMenuAllergenLabel, MENU_ALLERGEN_OPTIONS } from '../../data/menuAllergens'
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
  highlightProductId?: string | null
  /** Barra superior (volver, reservar…) que se pinta con los colores de la carta. */
  toolbar?: ReactNode
}

/* Fuentes muy de rótulo: se usan para títulos, pero el texto corrido va en Inter para leerse bien. */
const DISPLAY_ONLY_FONTS = ['Bebas Neue', 'Oswald']

interface Filters {
  query: string
  excluded: string[]
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function productMatches(node: MenuTreeNode, filters: Filters): boolean {
  if (!node.active) {
    return false
  }
  if (filters.excluded.length > 0 && node.allergens.some((allergen) => filters.excluded.includes(allergen))) {
    return false
  }
  if (filters.query) {
    const haystack = normalize(`${node.name} ${node.description}`)
    return haystack.includes(filters.query)
  }
  return true
}

function countVisibleProducts(node: MenuTreeNode, filters: Filters): number {
  if (node.nodeType === 'product') {
    return productMatches(node, filters) ? 1 : 0
  }
  return node.children.reduce((sum, child) => sum + countVisibleProducts(child, filters), 0)
}

function slugId(node: MenuTreeNode): string {
  return `menu-family-${node.id}`
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
      <div className={styles.photoLightboxPanel} onClick={(event) => event.stopPropagation()}>
        <img src={imageUrl} alt={name} className={styles.photoLightboxImage} />
        <div className={styles.photoLightboxHeader}>
          <p className={styles.photoLightboxTitle}>{name}</p>
          <button type="button" className={styles.photoLightboxClose} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Iconos de alérgenos: al tocar uno se ve su nombre un momento. */
function AllergenIcons({ allergens }: { allergens: string[] }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      return undefined
    }
    const timer = window.setTimeout(() => setActive(null), 2200)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <span className={styles.allergens}>
      {allergens.map((allergen) => {
        const label = getMenuAllergenLabel(allergen)
        const isActive = active === allergen
        return (
          <span key={allergen} className={styles.allergenWrap}>
            <button
              type="button"
              className={`${styles.allergenBtn} ${isActive ? styles.allergenBtnActive : ''}`}
              onClick={() => setActive(isActive ? null : allergen)}
              aria-label={label}
              title={label}
            >
              <span aria-hidden="true">{getMenuAllergenIcon(allergen)}</span>
            </button>
            {isActive ? (
              <span className={styles.allergenTooltip} role="tooltip">{label}</span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

function PhotoPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.placeholderIcon}>
      <path
        d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8M15 2c-1.5 1.5-2 3.5-2 6 0 2 1 3 2 3v11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface ProductProps {
  node: MenuTreeNode
  template: MenuTemplateConfig
  highlighted: boolean
  unavailable: boolean
}

function MenuListProduct({ node, template, highlighted, unavailable }: ProductProps) {
  const [photoOpen, setPhotoOpen] = useState(false)
  const hasPhoto = template.showPhotos && Boolean(node.photoUrl?.trim())
  const thumb = hasPhoto ? optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductGrid) : ''
  const priceLabel = node.priceCents != null ? formatMenuPrice(node.priceCents, node.priceCurrency) : null

  return (
    <>
      <article
        id={`product-${node.id}`}
        className={`${styles.listItem} ${highlighted ? styles.productHighlighted : ''} ${unavailable ? styles.productUnavailable : ''}`}
      >
        <div className={styles.listText}>
          <h4 className={styles.productName}>{node.name}</h4>
          {template.showDescriptions && node.description ? (
            <p className={styles.productDescription}>{node.description}</p>
          ) : null}
          <div className={styles.listMeta}>
            {priceLabel ? <span className={styles.productPrice}>{priceLabel}</span> : null}
            {template.showAllergens && node.allergens.length > 0 ? (
              <AllergenIcons allergens={node.allergens} />
            ) : null}
          </div>
        </div>
        {hasPhoto ? (
          <button
            type="button"
            className={styles.listThumb}
            onClick={() => setPhotoOpen(true)}
            aria-label={`Ver foto de ${node.name}`}
          >
            <img src={thumb} alt="" loading="lazy" />
          </button>
        ) : null}
      </article>
      {photoOpen ? (
        <ProductPhotoLightbox
          name={node.name}
          imageUrl={optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductLightbox)}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </>
  )
}

function MenuGridProduct({ node, template, highlighted, unavailable }: ProductProps) {
  const [photoOpen, setPhotoOpen] = useState(false)
  const hasPhoto = Boolean(node.photoUrl?.trim())
  const image = hasPhoto ? optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductGrid) : ''
  const priceLabel = node.priceCents != null ? formatMenuPrice(node.priceCents, node.priceCurrency) : null

  return (
    <>
      <article
        id={`product-${node.id}`}
        className={`${styles.gridCard} ${highlighted ? styles.productHighlighted : ''} ${unavailable ? styles.productUnavailable : ''}`}
      >
        {template.showPhotos ? (
          hasPhoto ? (
            <button
              type="button"
              className={styles.gridMedia}
              onClick={() => setPhotoOpen(true)}
              aria-label={`Ver foto de ${node.name}`}
            >
              <img src={image} alt="" loading="lazy" />
            </button>
          ) : (
            <div className={`${styles.gridMedia} ${styles.gridMediaEmpty}`} aria-hidden="true">
              <PhotoPlaceholder />
            </div>
          )
        ) : null}
        <div className={styles.gridBody}>
          <h4 className={styles.productName}>{node.name}</h4>
          {template.showDescriptions && node.description ? (
            <p className={styles.productDescription}>{node.description}</p>
          ) : null}
          <div className={styles.gridFooter}>
            {priceLabel ? <span className={styles.productPrice}>{priceLabel}</span> : <span />}
            {template.showAllergens && node.allergens.length > 0 ? (
              <AllergenIcons allergens={node.allergens} />
            ) : null}
          </div>
        </div>
      </article>
      {photoOpen ? (
        <ProductPhotoLightbox
          name={node.name}
          imageUrl={optimizeCloudinaryUrl(node.photoUrl, CLOUDINARY_DISPLAY.menuProductLightbox)}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </>
  )
}

function MenuPreview({
  board,
  nodes,
  restaurantName,
  embedded = false,
  fullscreen = false,
  highlightProductId = null,
  toolbar,
}: MenuPreviewProps) {
  const template = board.template
  const isGrid = template.layout === 'grid'
  const tree = useMemo(() => buildMenuTree(nodes.filter((node) => node.boardId === board.id)), [nodes, board.id])
  const rootProducts = tree.filter((node) => node.nodeType === 'product')
  const rootFamilies = tree.filter((node) => node.nodeType === 'family')

  const showSearch = template.showSearch !== false
  const showCategoryNav = template.showCategoryNav !== false
  const [query, setQuery] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const [allergenPanelOpen, setAllergenPanelOpen] = useState(false)
  const [activeFamily, setActiveFamily] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const filters: Filters = { query: normalize(query.trim()), excluded }
  const filtering = Boolean(filters.query) || excluded.length > 0

  const usedAllergens = useMemo(() => {
    const used = new Set(nodes.filter((node) => node.boardId === board.id).flatMap((node) => node.allergens))
    return MENU_ALLERGEN_OPTIONS.filter((option) => used.has(option.id))
  }, [nodes, board.id])

  const totalProducts = useMemo(
    () => nodes.filter((node) => node.boardId === board.id && node.nodeType === 'product' && node.active).length,
    [nodes, board.id],
  )

  const visibleFamilies = rootFamilies.filter((family) => countVisibleProducts(family, filters) > 0)
  const visibleRootProducts = rootProducts.filter((node) => productMatches(node, filters))
  const resultCount = filtering
    ? visibleFamilies.reduce((sum, family) => sum + countVisibleProducts(family, filters), 0) + visibleRootProducts.length
    : totalProducts

  useEffect(() => {
    if (!highlightProductId) {
      return
    }
    const element = document.getElementById(`product-${highlightProductId}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightProductId, nodes, board.id])

  // Marca en la barra de categorías la sección que se está viendo.
  useEffect(() => {
    if (!showCategoryNav || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const sections = visibleFamilies
      .map((family) => document.getElementById(slugId(family)))
      .filter((element): element is HTMLElement => Boolean(element))
    if (sections.length === 0) {
      return undefined
    }
    const scrollRoot = embedded ? rootRef.current?.closest('[class*="phoneMockupScreen"]') ?? null : null
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          setActiveFamily(visible[0].target.id)
        }
      },
      { root: scrollRoot, rootMargin: '-25% 0px -65% 0px' },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCategoryNav, embedded, visibleFamilies.map((family) => family.id).join('|')])

  const fontFamily = template.fontFamily
  const bodyFont = DISPLAY_ONLY_FONTS.some((font) => fontFamily.includes(font))
    ? "'Inter', system-ui, sans-serif"
    : fontFamily

  const themeStyle = {
    '--menu-bg': template.backgroundColor,
    '--menu-title': template.titleColor,
    '--menu-text': template.textColor,
    '--menu-accent': template.accentColor,
    '--menu-family': template.familyColor,
    '--menu-subfamily': template.subfamilyColor,
    '--menu-price': template.priceColor,
    '--menu-font': fontFamily,
    '--menu-body-font': bodyFont,
    '--menu-bg-image-opacity': String(template.backgroundImageOpacity / 100),
  } as CSSProperties

  const renderProducts = (products: MenuTreeNode[], unavailable: boolean) => {
    const items = products.filter((product) => productMatches(product, filters))
    if (items.length === 0) {
      return null
    }
    return (
      <div className={isGrid ? styles.gridLayout : styles.listLayout}>
        {items.map((product) => (isGrid ? (
          <MenuGridProduct
            key={product.id}
            node={product}
            template={template}
            highlighted={highlightProductId === product.id}
            unavailable={unavailable}
          />
        ) : (
          <MenuListProduct
            key={product.id}
            node={product}
            template={template}
            highlighted={highlightProductId === product.id}
            unavailable={unavailable}
          />
        )))}
      </div>
    )
  }

  const renderFamily = (node: MenuTreeNode, parentUnavailable = false): ReactNode => {
    // Sin platos que enseñar (vacía o filtrada): no se pinta la sección.
    if (countVisibleProducts(node, filters) === 0) {
      return null
    }
    const isSubfamily = Boolean(node.parentId)
    const childFamilies = node.children.filter((child) => child.nodeType === 'family')
    const childProducts = node.children.filter((child) => child.nodeType === 'product')
    const availabilityLabel = formatMenuCategoryAvailability(node.availability)
    const ownUnavailable = node.availability.enabled && !isMenuCategoryAvailable(node.availability)
    const unavailable = parentUnavailable || ownUnavailable
    const count = countVisibleProducts(node, filters)

    return (
      <section
        key={node.id}
        id={isSubfamily ? undefined : slugId(node)}
        className={isSubfamily ? styles.subfamily : styles.family}
      >
        <header className={isSubfamily ? styles.subfamilyHeading : styles.familyHeading}>
          <h3 className={isSubfamily ? styles.subfamilyTitle : styles.familyTitle}>{node.name}</h3>
          {!isSubfamily && count > 0 ? <span className={styles.familyCount}>{count}</span> : null}
          {availabilityLabel ? (
            <span className={`${styles.familyAvailability} ${ownUnavailable ? styles.familyAvailabilityOff : ''}`}>
              {ownUnavailable ? `Disponible ${availabilityLabel}` : availabilityLabel}
            </span>
          ) : null}
        </header>
        {ownUnavailable ? (
          <p className={styles.unavailableNote}>
            Ahora mismo fuera de horario. Puedes ver los platos; se sirven {availabilityLabel}.
          </p>
        ) : null}
        {renderProducts(childProducts, unavailable)}
        {childFamilies.map((child) => renderFamily(child, unavailable))}
      </section>
    )
  }

  const toggleExcluded = (allergen: string) => {
    setExcluded((current) => (current.includes(allergen)
      ? current.filter((item) => item !== allergen)
      : [...current, allergen]))
  }

  const scrollToFamily = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveFamily(id)
  }

  return (
    <div
      ref={rootRef}
      className={[
        styles.preview,
        embedded ? styles.previewEmbedded : '',
        fullscreen ? styles.previewFullscreen : '',
        isGrid ? styles.previewGrid : styles.previewList,
        styles[`card_${template.cardStyle ?? 'soft'}`],
        template.density === 'compact' ? styles.compact : '',
        styles[`photo_${template.photoShape ?? 'rounded'}`],
      ].filter(Boolean).join(' ')}
      style={themeStyle}
    >
      {template.backgroundImageUrl ? (
        <img src={template.backgroundImageUrl} alt="" className={styles.bgImage} />
      ) : null}

      {toolbar ? <div className={styles.topBar}>{toolbar}</div> : null}

      <div className={styles.previewInner}>
        <header className={`${styles.hero} ${template.headerAlign === 'left' ? styles.heroLeft : ''}`}>
          {restaurantName ? <p className={styles.restaurantName}>{restaurantName}</p> : null}
          <h2 className={styles.boardName}>{board.name}</h2>
          {template.tagline ? <p className={styles.tagline}>{template.tagline}</p> : null}
          <span className={styles.heroRule} aria-hidden="true" />
        </header>

        {showSearch && totalProducts > 0 ? (
          <div className={styles.tools}>
            <label className={styles.searchField}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar un plato…"
                aria-label="Buscar en la carta"
              />
            </label>
            {usedAllergens.length > 0 ? (
              <button
                type="button"
                className={`${styles.filterButton} ${excluded.length > 0 ? styles.filterButtonOn : ''}`}
                onClick={() => setAllergenPanelOpen((open) => !open)}
                aria-expanded={allergenPanelOpen}
              >
                Alérgenos{excluded.length > 0 ? ` · ${excluded.length}` : ''}
              </button>
            ) : null}
          </div>
        ) : null}

        {showSearch && allergenPanelOpen && usedAllergens.length > 0 ? (
          <div className={styles.allergenPanel}>
            <p>Oculta los platos que lleven:</p>
            <div className={styles.allergenChips}>
              {usedAllergens.map((option) => {
                const on = excluded.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.allergenChip} ${on ? styles.allergenChipOn : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleExcluded(option.id)}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                    {option.label}
                  </button>
                )
              })}
            </div>
            {excluded.length > 0 ? (
              <button type="button" className={styles.clearLink} onClick={() => setExcluded([])}>
                Quitar filtro
              </button>
            ) : null}
          </div>
        ) : null}

        {showCategoryNav && visibleFamilies.length > 1 ? (
          <nav className={styles.categoryNav} aria-label="Categorías de la carta">
            <div className={styles.categoryNavScroll}>
              {visibleFamilies.map((family) => {
                const id = slugId(family)
                return (
                  <button
                    key={family.id}
                    type="button"
                    className={`${styles.categoryChip} ${activeFamily === id ? styles.categoryChipOn : ''}`}
                    onClick={() => scrollToFamily(id)}
                  >
                    {family.name}
                  </button>
                )
              })}
            </div>
          </nav>
        ) : null}

        {filtering ? (
          <p className={styles.resultNote}>
            {resultCount === 0
              ? 'Ningún plato coincide.'
              : `${resultCount} ${resultCount === 1 ? 'plato' : 'platos'}`}
            <button
              type="button"
              className={styles.clearLink}
              onClick={() => {
                setQuery('')
                setExcluded([])
              }}
            >
              Ver toda la carta
            </button>
          </p>
        ) : null}

        <div className={styles.sections}>
          {visibleFamilies.map((family) => renderFamily(family))}
          {visibleRootProducts.length > 0 ? (
            <section className={styles.family}>
              {visibleFamilies.length > 0 ? (
                <header className={styles.familyHeading}>
                  <h3 className={styles.familyTitle}>Más</h3>
                </header>
              ) : null}
              {renderProducts(rootProducts, false)}
            </section>
          ) : null}
        </div>

        {rootFamilies.length === 0 && rootProducts.length === 0 ? (
          <p className={styles.empty}>Añade familias o productos para ver la carta.</p>
        ) : null}
      </div>
    </div>
  )
}

export default MenuPreview
