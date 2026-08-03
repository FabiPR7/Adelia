import { useId, useRef, useState, type ChangeEvent } from 'react'
import { uploadToCloudinary } from '../utils/cloudinaryUpload'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './MediaGalleryUploader.module.css'

interface MediaGalleryUploaderProps {
  label: string
  hint?: string
  urls: string[]
  maxItems: number
  mediaType: 'image' | 'video'
  onChange: (urls: string[]) => void
}

function MediaGalleryUploader({
  label,
  hint,
  urls,
  maxItems,
  mediaType,
  onChange,
}: MediaGalleryUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAddMore = urls.length < maxItems
  const accept = mediaType === 'image' ? 'image/*' : 'video/*'

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const isValidType =
      mediaType === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/')

    if (!isValidType) {
      setError(
        mediaType === 'image'
          ? 'Selecciona un archivo de imagen válido.'
          : 'Selecciona un archivo de vídeo válido.',
      )
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const secureUrl = await uploadToCloudinary(file, mediaType)
      onChange([...urls, secureUrl].slice(0, maxItems))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = (index: number) => {
    onChange(urls.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>{label}</span>
      {hint && <p className={styles.hint}>{hint}</p>}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className={styles.hiddenInput}
        onChange={handleFileChange}
        disabled={isUploading || !canAddMore}
      />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {isUploading && (
        <div className={styles.loaderBox} aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Subiendo {mediaType === 'image' ? 'foto' : 'vídeo'}…</span>
        </div>
      )}

      <div className={styles.grid}>
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className={styles.item}>
            {mediaType === 'image' ? (
              <img
                src={optimizeCloudinaryUrl(url, CLOUDINARY_DISPLAY.photoThumb)}
                alt=""
                className={styles.media}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <video src={url} className={styles.media} controls preload="none" />
            )}
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => handleRemove(index)}
              aria-label={`Eliminar ${mediaType === 'image' ? 'foto' : 'vídeo'} ${index + 1}`}
            >
              ×
            </button>
          </div>
        ))}

        {canAddMore && !isUploading && (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => inputRef.current?.click()}
          >
            + Añadir {mediaType === 'image' ? 'foto' : 'vídeo'} ({urls.length}/{maxItems})
          </button>
        )}
      </div>
    </div>
  )
}

export default MediaGalleryUploader
