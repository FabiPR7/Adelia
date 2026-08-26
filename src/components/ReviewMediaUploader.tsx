import { useId, useRef, useState, type ChangeEvent } from 'react'
import type { ReviewMediaItem } from '../types/review'
import { VIDEO_FILE_ACCEPT } from '../constants/fileUpload'
import { CLOUDINARY_DISPLAY, cloudinaryVideoPosterUrl, optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl } from '../utils/cloudinaryUrl'
import { getCloudinaryResourceType, uploadToCloudinary } from '../utils/cloudinaryUpload'
import { prepareVideoForUpload } from '../utils/videoMedia'
import styles from './ReviewMediaUploader.module.css'

const MAX_MEDIA_ITEMS = 6

interface ReviewMediaUploaderProps {
  value: ReviewMediaItem[]
  onChange: (items: ReviewMediaItem[]) => void
  disabled?: boolean
}

function ReviewMediaUploader({ value, onChange, disabled = false }: ReviewMediaUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [error, setError] = useState('')

  const isUploading = uploadingCount > 0
  const canAddMore = value.length < MAX_MEDIA_ITEMS

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setError('')
    const remainingSlots = MAX_MEDIA_ITEMS - value.length
    const filesToUpload = files.slice(0, remainingSlots)
    const uploadedItems: ReviewMediaItem[] = []

    setUploadingCount(filesToUpload.length)

    try {
      for (const file of filesToUpload) {
        const resourceType = getCloudinaryResourceType(file)
        if (!resourceType) {
          throw new Error('Solo puedes subir fotos o vídeos.')
        }

        const fileToUpload = resourceType === 'video'
          ? await prepareVideoForUpload(file)
          : file
        const url = await uploadToCloudinary(fileToUpload, resourceType)
        uploadedItems.push({ url, type: resourceType })
      }

      onChange([...value, ...uploadedItems])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo.')
    } finally {
      setUploadingCount(0)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>Fotos y vídeos</span>
        <span className={styles.counter}>{value.length}/{MAX_MEDIA_ITEMS}</span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={`image/*,${VIDEO_FILE_ACCEPT}`}
        multiple
        className={styles.hiddenInput}
        onChange={(event) => void handleFileChange(event)}
        disabled={disabled || isUploading || !canAddMore}
      />

      {value.length > 0 ? (
        <ul className={styles.mediaGrid}>
          {value.map((item, index) => {
            const previewUrl = item.type === 'image'
              ? optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)
              : item.url

            return (
              <li key={`${item.url}-${index}`} className={styles.mediaItem}>
                {item.type === 'image' ? (
                  <img src={previewUrl} alt="" className={styles.mediaPreview} />
                ) : (
                  <video
                    src={optimizeCloudinaryVideoUrl(item.url)}
                    poster={cloudinaryVideoPosterUrl(item.url) || undefined}
                    className={styles.mediaPreview}
                    controls
                    muted
                    preload="metadata"
                    playsInline
                  />
                )}
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemove(index)}
                  disabled={disabled || isUploading}
                  aria-label="Quitar archivo"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {canAddMore ? (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? 'Preparando y subiendo…' : 'Añadir foto o vídeo'}
        </button>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}

export default ReviewMediaUploader
