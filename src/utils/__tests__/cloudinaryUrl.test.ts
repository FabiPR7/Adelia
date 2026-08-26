import { describe, expect, it } from 'vitest'
import {
  cloudinaryVideoPosterUrl,
  ensureHttpsUrl,
  optimizeCloudinaryVideoUrl,
} from '../cloudinaryUrl'

const sample = 'https://res.cloudinary.com/adelia/video/upload/v1/locals/clip.mp4'

describe('cloudinary video URLs', () => {
  it('debería forzar https', () => {
    expect(ensureHttpsUrl('http://res.cloudinary.com/x/video/upload/a.mp4')).toBe(
      'https://res.cloudinary.com/x/video/upload/a.mp4',
    )
  })

  it('debería comprimir el vídeo al reproducir, no al guardar', () => {
    expect(optimizeCloudinaryVideoUrl(sample)).toBe(
      'https://res.cloudinary.com/adelia/video/upload/f_mp4,q_auto,w_720/v1/locals/clip.mp4',
    )
    expect(optimizeCloudinaryVideoUrl(optimizeCloudinaryVideoUrl(sample))).toContain('f_mp4')
  })

  it('debería generar un fotograma 16:9 para el póster', () => {
    expect(cloudinaryVideoPosterUrl(sample)).toContain('so_0')
    expect(cloudinaryVideoPosterUrl(sample)).toContain('ar_16:9')
    expect(cloudinaryVideoPosterUrl(sample)).toContain('f_jpg')
    expect(cloudinaryVideoPosterUrl('https://cdn.example.com/clip.mp4')).toBe('')
  })

  it('debería tratar un clip subido como imagen o raw como vídeo', () => {
    const asImage = 'https://res.cloudinary.com/adelia/image/upload/v1/locals/clip.mp4'
    expect(optimizeCloudinaryVideoUrl(asImage)).toContain('/video/upload/')
    expect(optimizeCloudinaryVideoUrl(asImage)).toContain('f_mp4')
    expect(cloudinaryVideoPosterUrl(asImage)).toContain('/video/upload/')
    expect(
      optimizeCloudinaryVideoUrl('https://res.cloudinary.com/adelia/image/upload/v1/locals/clip-adelia'),
    ).toContain('/video/upload/')
  })
})
