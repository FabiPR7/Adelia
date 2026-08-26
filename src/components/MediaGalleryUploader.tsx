import { useId, useRef, useState, type ChangeEvent } from 'react'
import { uploadToCloudinary } from '../utils/cloudinaryUpload'
import {
  CLOUDINARY_DISPLAY,
  cloudinaryVideoPosterUrl,
  ensureHttpsUrl,
  optimizeCloudinaryUrl,
  optimizeCloudinaryVideoUrl,
} from '../utils/cloudinaryUrl'
import { adjustMainPhotoIndexAfterRemove } from '../utils/companyPhotos'
import { prepareVideoForUpload, type VideoPreparePhase } from '../utils/videoMedia'
import { isAllowedVideoFile, VIDEO_FILE_ACCEPT } from '../constants/fileUpload'
import styles from './MediaGalleryUploader.module.css'

interface MediaGalleryUploaderProps {
  label: string
  hint?: string
  urls: string[]
  maxItems: number
  mediaType: 'image' | 'video'
  mainPhotoIndex?: number
  onMainPhotoIndexChange?: (index: number) => void
  onChange: (urls: string[]) => void
}

function uploadStatusLabel(
  mediaType: 'image' | 'video',
  phase: VideoPreparePhase | 'uploading',
  progress: number | null,
): string {
  if (mediaType === 'image') {
    return 'Subiendo foto…'
  }

  if (phase === 'checking') {
    return 'Comprobando duración y tamaño…'
  }

  if (phase === 'compressing') {
    if (progress != null) {
      return `Comprimiendo a HD (30 s)… ${progress}%`
    }
    return 'Comprimiendo el vídeo a un clip HD de 30 s…'
  }

  if (progress != null && progress < 100) {
    return `Subiendo vídeo… ${progress}%`
  }

  return 'Subiendo vídeo…'
}

function PreviewVideo({ url }: { url: string }) {
  const original = ensureHttpsUrl(url)
  const optimized = optimizeCloudinaryVideoUrl(url)
  const [src, setSrc] = useState(optimized)

  return (
    <video
      src={src}
      poster={cloudinaryVideoPosterUrl(url) || undefined}
      className={styles.media}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      onError={() => {
        if (src !== original) {
          setSrc(original)
        }
      }}
    />
  )
}

function MediaGalleryUploader({
  label,
  hint,
  urls,
  maxItems,
  mediaType,
  mainPhotoIndex = 0,
  onMainPhotoIndexChange,
  onChange,
}: MediaGalleryUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<VideoPreparePhase | 'uploading'>('checking')
  const [progress, setProgress] = useState<number | null>(null)

  const canAddMore = urls.length < maxItems
  const accept = mediaType === 'image' ? 'image/*' : VIDEO_FILE_ACCEPT

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (mediaType === 'image' && !file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen válido.')
      return
    }

    if (mediaType === 'video') {
      if (!isAllowedVideoFile(file)) {
        setError('Usa un vídeo MP4, MOV o WebM.')
        if (inputRef.current) {
          inputRef.current.value = ''
        }
        return
      }
    }

    setError(null)
    setIsUploading(true)
    setProgress(null)
    setPhase(mediaType === 'video' ? 'checking' : 'uploading')

    try {
      const fileToUpload = mediaType === 'video'
        ? await prepareVideoForUpload(file, {
          onPhase: (nextPhase) => {
            setPhase(nextPhase)
            if (nextPhase === 'compressing') {
              setProgress(0)
            }
          },
          onCompressProgress: setProgress,
        })
        : file

      setPhase('uploading')
      setProgress(mediaType === 'video' ? 0 : null)
      const secureUrl = await uploadToCloudinary(fileToUpload, mediaType, {
        onProgress: setProgress,
      })
      onChange([...urls, secureUrl].slice(0, maxItems))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo.')
    } finally {
      setIsUploading(false)
      setProgress(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = (index: number) => {
    const nextUrls = urls.filter((_, itemIndex) => itemIndex !== index)
    onChange(nextUrls)

    if (mediaType === 'image' && onMainPhotoIndexChange) {
      onMainPhotoIndexChange(
        adjustMainPhotoIndexAfterRemove(mainPhotoIndex, index, nextUrls.length),
      )
    }
  }

  const canSetMain = mediaType === 'image' && Boolean(onMainPhotoIndexChange)

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
          <div className={styles.loaderCopy}>
            <span>{uploadStatusLabel(mediaType, phase, progress)}</span>
            {mediaType === 'video' && progress != null ? (
              <span className={styles.progressTrack} aria-hidden="true">
                <span className={styles.progressFill} style={{ width: `${Math.max(6, progress)}%` }} />
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className={`${styles.grid} ${mediaType === 'video' ? styles.gridVideo : ''}`}>
        {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className={`${styles.item} ${mediaType === 'video' ? styles.itemVideo : ''} ${canSetMain && index === mainPhotoIndex ? styles.itemMain : ''}`}
            >
              {mediaType === 'image' ? (
                <img
                  src={optimizeCloudinaryUrl(url, CLOUDINARY_DISPLAY.photoThumb)}
                  alt=""
                  className={styles.media}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <PreviewVideo url={url} />
              )}
              {canSetMain && (
                <button
                  type="button"
                  className={`${styles.mainButton} ${index === mainPhotoIndex ? styles.mainButtonActive : ''}`}
                  onClick={() => onMainPhotoIndexChange?.(index)}
                  aria-label={index === mainPhotoIndex ? `Foto principal ${index + 1}` : `Marcar foto ${index + 1} como principal`}
                  aria-pressed={index === mainPhotoIndex}
                >
                  ★
                </button>
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
