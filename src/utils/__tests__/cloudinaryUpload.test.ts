import { describe, expect, it } from 'vitest'
import {
  CLOUDINARY_CHUNK_SIZE,
  cloudinaryByteRanges,
  cloudinaryUploadEndpoint,
  formatCloudinaryUploadError,
  getCloudinaryResourceType,
  shouldUseChunkedCloudinaryUpload,
} from '../cloudinaryUpload'

describe('cloudinary upload helpers', () => {
  it('debería partir vídeos grandes en chunks de 6 MB', () => {
    const ranges = cloudinaryByteRanges(13 * 1024 * 1024)
    expect(ranges).toHaveLength(3)
    expect(ranges[0]).toEqual({ start: 0, endExclusive: CLOUDINARY_CHUNK_SIZE })
    expect(ranges.at(-1)?.endExclusive).toBe(13 * 1024 * 1024)
    expect(cloudinaryByteRanges(0)).toEqual([])
  })

  it('debería usar subida por partes solo en vídeos pesados', () => {
    expect(shouldUseChunkedCloudinaryUpload(7 * 1024 * 1024, 'video')).toBe(false)
    expect(shouldUseChunkedCloudinaryUpload(8 * 1024 * 1024, 'video')).toBe(true)
    expect(shouldUseChunkedCloudinaryUpload(20 * 1024 * 1024, 'image')).toBe(false)
  })

  it('debería construir el endpoint de Cloudinary', () => {
    expect(cloudinaryUploadEndpoint('video', 'adelia')).toBe(
      'https://api.cloudinary.com/v1_1/adelia/video/upload',
    )
  })

  it('debería traducir Failed to fetch a un error accionable', () => {
    expect(formatCloudinaryUploadError(new TypeError('Failed to fetch'), 'video')).toContain('40 MB')
    expect(formatCloudinaryUploadError(new Error('Timeout'), 'video')).toContain('corto')
    expect(formatCloudinaryUploadError(new Error('File size too large'), 'video')).toContain('tamaño')
    expect(formatCloudinaryUploadError(new Error('Upload preset must be whitelisted'), 'video')).toContain('preset')
  })

  it('debería detectar fotos y vídeos por tipo o extensión', () => {
    expect(getCloudinaryResourceType(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))).toBe('image')
    expect(getCloudinaryResourceType(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))).toBe('video')
    expect(getCloudinaryResourceType(new File(['x'], 'clip.MOV', { type: '' }))).toBe('video')
    expect(getCloudinaryResourceType(new File(['x'], 'nota.pdf', { type: 'application/pdf' }))).toBeNull()
  })
})
