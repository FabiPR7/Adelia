import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
  isAllowedImageType,
  isAllowedImageExtension,
  formatFileSize,
} from '../constants/fileUpload'
import { useCompanyDemo } from '../context/CompanyDemoContext'
import styles from './ImageUploader.module.css'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void
  onImageRemoved?: () => void
  currentImageUrl?: string
  label?: string
  hint?: string
}

async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Faltan VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET en .env.local',
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  const data = (await response.json()) as {
    secure_url?: string
    error?: { message?: string }
  }

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? 'No se pudo subir la imagen.')
  }

  return data.secure_url
}

function ImageUploader({
  onImageUploaded,
  onImageRemoved,
  currentImageUrl = '',
  label = 'Imagen',
  hint,
}: ImageUploaderProps) {
  const demo = useCompanyDemo()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPreviewUrl(currentImageUrl)
  }, [currentImageUrl])

  const displayUrl = previewUrl || currentImageUrl
  const optimizedDisplayUrl = displayUrl
    ? optimizeCloudinaryUrl(displayUrl, CLOUDINARY_DISPLAY.photoPreview)
    : ''

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!isAllowedImageType(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WEBP.')
      return
    }

    if (!isAllowedImageExtension(file.name)) {
      setError('Extensión de archivo no permitida.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`Archivo demasiado grande. Máximo ${formatFileSize(MAX_FILE_SIZE)}.`)
      return
    }

    try {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.src = objectUrl

      await img.decode()
      URL.revokeObjectURL(objectUrl)

      if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
        setError(`Dimensiones demasiado grandes. Máximo ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}px.`)
        return
      }
    } catch {
      setError('No se pudo validar la imagen.')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const secureUrl = await uploadToCloudinary(file)
      setPreviewUrl(secureUrl)
      onImageUploaded(secureUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreviewUrl('')
    setError(null)
    onImageRemoved?.()
    onImageUploaded('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleChangeClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className={styles.wrapper}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {hint && <p className={styles.hint}>{hint}</p>}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleFileChange}
        disabled={isUploading || demo}
      />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {demo ? (
        displayUrl ? (
          <div className={styles.previewBox}>
            <img src={optimizedDisplayUrl} alt="Vista previa" className={styles.previewImage} />
          </div>
        ) : (
          <p className={styles.hint}>Sin imagen</p>
        )
      ) : isUploading ? (
        <div className={styles.loaderBox} aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Subiendo imagen…</span>
        </div>
      ) : displayUrl ? (
        <div className={styles.previewBox}>
          <img src={optimizedDisplayUrl} alt="Vista previa" className={styles.previewImage} />
          <div className={styles.previewActions}>
            <button type="button" className={styles.secondaryButton} onClick={handleChangeClick}>
              Cambiar
            </button>
            <button type="button" className={styles.dangerButton} onClick={handleRemove}>
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.uploadButton}
          onClick={handleChangeClick}
          disabled={isUploading}
        >
          Seleccionar imagen
        </button>
      )}
    </div>
  )
}

export default ImageUploader
