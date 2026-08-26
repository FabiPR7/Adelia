import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateCompanyQrBranding } from '../services/firestore'
import type { QrBrandingConfig, QrBrandingKind } from '../types/company'
import { buildBrandedQrDataUrl, downloadBookingQrCode } from '../utils/bookingQr'
import {
  defaultQrBrandingConfig,
  normalizeQrBrandingConfig,
  QR_BRANDING_KIND_LABELS,
  resolveBrandedQrOptions,
  resolveDefaultSubtitle,
  type ResolveQrBrandingContext,
} from '../utils/qrBranding'
import styles from './QrCustomizerModal.module.css'

interface QrCustomizerModalProps {
  isOpen: boolean
  kind: QrBrandingKind
  url: string
  filename: string
  companyId: string
  context: ResolveQrBrandingContext
  initialConfig: QrBrandingConfig
  onClose: () => void
  onSaved?: (config: QrBrandingConfig) => void
}

function QrCustomizerModal({
  isOpen,
  kind,
  url,
  filename,
  companyId,
  context,
  initialConfig,
  onClose,
  onSaved,
}: QrCustomizerModalProps) {
  const { refreshCompany } = useAuth()
  const [config, setConfig] = useState<QrBrandingConfig>(() => normalizeQrBrandingConfig(initialConfig))
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setConfig(normalizeQrBrandingConfig(initialConfig))
    setError(null)
    setSuccess(null)
    setPreviewError(null)
  }, [initialConfig, isOpen])

  const renderOptions = useMemo(
    () => resolveBrandedQrOptions(config, kind, context),
    [config, kind, context],
  )

  const defaultSubtitle = useMemo(
    () => resolveDefaultSubtitle(kind, context),
    [kind, context],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false
    setIsGeneratingPreview(true)
    setPreviewError(null)

    const timer = window.setTimeout(() => {
      void buildBrandedQrDataUrl(url, renderOptions)
        .then((dataUrl) => {
          if (!cancelled) {
            setPreviewUrl(dataUrl)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewUrl(null)
            if (config.logoMode === 'restaurant' && context.companyLogoUrl.trim()) {
              setPreviewError('No se pudo cargar el logo del restaurante. Guarda el contacto y vuelve a intentarlo.')
            } else {
              setPreviewError('No se pudo generar la vista previa.')
            }
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsGeneratingPreview(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, renderOptions, url, config.logoMode, context.companyLogoUrl])

  if (!isOpen) {
    return null
  }

  const updateConfig = (patch: Partial<QrBrandingConfig>) => {
    setConfig((current) => normalizeQrBrandingConfig({ ...current, ...patch }))
    setSuccess(null)
  }

  const handleReset = () => {
    setConfig(defaultQrBrandingConfig())
    setSuccess(null)
    setError(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const normalized = normalizeQrBrandingConfig(config)
      await updateCompanyQrBranding(companyId, kind, normalized)
      await refreshCompany()
      onSaved?.(normalized)
      setSuccess('Diseño del QR guardado.')
    } catch {
      setError('No se pudo guardar la personalización.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    setError(null)

    try {
      await downloadBookingQrCode(url, filename, renderOptions)
    } catch {
      setError('No se pudo descargar el QR.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-customizer-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="qr-customizer-title">Personalizar QR</h2>
            <p>{QR_BRANDING_KIND_LABELS[kind]}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.form}>
            <label className={styles.field}>
              Logo superior
              <select
                value={config.logoMode}
                onChange={(event) => updateConfig({ logoMode: event.target.value as QrBrandingConfig['logoMode'] })}
              >
                <option value="adelia">Logo de Adelia</option>
                <option value="restaurant">Logo del restaurante</option>
                <option value="none">Sin logo</option>
              </select>
            </label>

            {config.logoMode === 'restaurant' && !context.companyLogoUrl.trim() ? (
              <p className={styles.fieldHint}>
                Sube el logo del restaurante en Contacto y pulsa «Guardar contacto» para usarlo aquí.
              </p>
            ) : null}

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={config.showTitle}
                onChange={(event) => updateConfig({ showTitle: event.target.checked })}
              />
              Mostrar título
            </label>

            {config.showTitle ? (
              <label className={styles.field}>
                Título
                <input
                  value={config.title}
                  onChange={(event) => updateConfig({ title: event.target.value })}
                  placeholder="Adelia"
                  maxLength={60}
                />
              </label>
            ) : null}

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={config.showSubtitle}
                onChange={(event) => updateConfig({ showSubtitle: event.target.checked })}
              />
              Mostrar subtítulo
            </label>

            {config.showSubtitle ? (
              <label className={styles.field}>
                Subtítulo
                <input
                  value={config.subtitle}
                  onChange={(event) => updateConfig({ subtitle: event.target.value })}
                  placeholder={defaultSubtitle || 'Nombre del local o carta'}
                  maxLength={80}
                />
              </label>
            ) : null}

            <label className={styles.field}>
              Color del QR
              <div className={styles.colorRow}>
                <input
                  type="color"
                  value={config.darkColor}
                  onChange={(event) => updateConfig({ darkColor: event.target.value })}
                  aria-label="Color del QR"
                />
                <input
                  type="text"
                  value={config.darkColor}
                  onChange={(event) => updateConfig({ darkColor: event.target.value })}
                  maxLength={7}
                  spellCheck={false}
                />
              </div>
            </label>
          </div>

          <div className={styles.previewPanel}>
            <span className={styles.previewLabel}>Vista previa</span>
            <div className={styles.previewFrame}>
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa del QR personalizado" className={styles.previewImage} />
              ) : (
                <p className={styles.previewPlaceholder}>
                  {isGeneratingPreview ? 'Generando vista previa…' : previewError || 'Sin vista previa'}
                </p>
              )}
            </div>
          </div>
        </div>

        {(error || success) && (
          <div className={styles.feedback}>
            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}
          </div>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.secondaryButton} onClick={handleReset} disabled={isSaving}>
            Restablecer
          </button>
          <div className={styles.footerActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void handleDownload()}
              disabled={isDownloading || isSaving}
            >
              {isDownloading ? 'Descargando…' : 'Descargar'}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSave()}
              disabled={isSaving || isDownloading}
            >
              {isSaving ? 'Guardando…' : 'Guardar diseño'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default QrCustomizerModal
