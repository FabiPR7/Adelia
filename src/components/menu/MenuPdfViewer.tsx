import { useMemo } from 'react'
import { canRenderCloudinaryPdfPages, cloudinaryPdfPageUrl, ensureHttpsUrl } from '../../utils/cloudinaryUrl'
import styles from './MenuPdfViewer.module.css'

interface MenuPdfViewerProps {
  pdfUrl: string
  pdfPages?: number
  fileName?: string
  title?: string
}

function MenuPdfViewer({ pdfUrl, pdfPages = 0, fileName, title }: MenuPdfViewerProps) {
  const sourceUrl = useMemo(() => ensureHttpsUrl(pdfUrl), [pdfUrl])
  const showPages = canRenderCloudinaryPdfPages(sourceUrl) && pdfPages > 0

  if (!sourceUrl) {
    return null
  }

  if (!showPages) {
    return (
      <div className={styles.viewer}>
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        <iframe
          className={styles.frame}
          src={sourceUrl}
          title={fileName || title || 'Carta en PDF'}
        />
        <a className={styles.openLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">
          Abrir PDF
        </a>
      </div>
    )
  }

  return (
    <div className={styles.viewer}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {Array.from({ length: pdfPages }, (_, index) => {
        const page = index + 1
        return (
          <figure key={`${sourceUrl}-${page}`} className={styles.page}>
            <img
              src={cloudinaryPdfPageUrl(sourceUrl, page)}
              alt={`Página ${page}${fileName ? ` de ${fileName}` : ''}`}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          </figure>
        )
      })}
      <a className={styles.openLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">
        Abrir PDF
      </a>
    </div>
  )
}

export default MenuPdfViewer
