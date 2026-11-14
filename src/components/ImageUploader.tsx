import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  MAX_FILE_SIZE,
  MAX_SOURCE_IMAGE_FILE_SIZE,
  isAllowedImageType,
  isAllowedImageExtension,
  formatFileSize,
} from '../constants/fileUpload'
import { useCompanyDemo } from '../context/CompanyDemoContext'
import { uploadToCloudinary } from '../utils/cloudinaryUpload'
import { downscaleImageFile } from '../utils/imageResize'
import ImageCropModal from './ImageCropModal'
import styles from './ImageUploader.module.css'

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void
  onImageRemoved?: () => void
  currentImageUrl?: string
  label?: string
  hint?: string
  /** Si se indica, antes de subir se abre un recorte con zoom (1 = cuadrado). */
  cropAspect?: number
  cropRound?: boolean
}

// Sube por el servidor de firmas si está activo; si no, con el preset de siempre.
function uploadImage(file: File): Promise<string> {
  return uploadToCloudinary(file, 'image')
}

function ImageUploader({
  onImageUploaded,
  onImageRemoved,
  currentImageUrl = '',
  label = 'Imagen',
  hint,
  cropAspect,
  cropRound = false,
}: ImageUploaderProps) {
  const demo = useCompanyDemo()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)

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

    // Las fotos del móvil pesan y miden mucho: se reducen aquí, no se rechazan.
    if (file.size > MAX_SOURCE_IMAGE_FILE_SIZE) {
      setError(`La foto pesa demasiado (${formatFileSize(file.size)}). Elige una de menos de ${formatFileSize(MAX_SOURCE_IMAGE_FILE_SIZE)}.`)
      resetInput()
      return
    }

    setError(null)
    if (cropAspect) {
      setCropFile(file)
      return
    }

    await uploadPrepared(file)
  }

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadPrepared = async (file: File) => {
    setIsUploading(true)
    try {
      const prepared = await downscaleImageFile(file)
      if (prepared.size > MAX_FILE_SIZE) {
        throw new Error(`No se pudo dejar la foto por debajo de ${formatFileSize(MAX_FILE_SIZE)}. Prueba con otra.`)
      }
      const secureUrl = await uploadImage(prepared)
      setPreviewUrl(secureUrl)
      onImageUploaded(secureUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen.')
    } finally {
      setIsUploading(false)
      resetInput()
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
      {cropFile ? (
        <ImageCropModal
          file={cropFile}
          aspect={cropAspect}
          round={cropRound}
          onCancel={() => {
            setCropFile(null)
            resetInput()
          }}
          onConfirm={(cropped) => {
            setCropFile(null)
            void uploadPrepared(cropped)
          }}
        />
      ) : null}
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
