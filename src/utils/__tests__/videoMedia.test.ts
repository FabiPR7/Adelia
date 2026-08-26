import { describe, expect, it, vi } from 'vitest'
import {
  clipRecordSeconds,
  fitVideoFrame,
  needsVideoCompression,
  prepareVideoForUpload,
  videoCompressFailedMessage,
  videoSourceTooLargeMessage,
  videoTooHeavyMessage,
} from '../videoMedia'

function videoFile(name: string, type: string, size = 1024) {
  const file = new File(['clip'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('compresión de vídeo de perfil', () => {
  it('debería bajar un 4K vertical a 720p sin deformarlo', () => {
    expect(fitVideoFrame(1080, 1920)).toEqual({ width: 720, height: 1280 })
    expect(fitVideoFrame(1920, 1080)).toEqual({ width: 1280, height: 720 })
    expect(clipRecordSeconds(12)).toBe(12)
    expect(clipRecordSeconds(240)).toBe(30)
  })

  it('debería comprimir si pesa 223 MB aunque dure 20 s', () => {
    expect(needsVideoCompression(223 * 1024 * 1024, 20)).toBe(true)
    expect(needsVideoCompression(8 * 1024 * 1024, 18)).toBe(false)
    expect(needsVideoCompression(8 * 1024 * 1024, 91)).toBe(true)
  })

  it('debería rechazar formatos que no sean clip de local', async () => {
    await expect(prepareVideoForUpload(videoFile('pelicula.mkv', 'video/x-matroska'))).rejects.toThrow(
      /MP4, MOV o WebM/,
    )
  })

  it('debería rechazar un original de más de 512 MB', async () => {
    const readDuration = vi.fn(async () => 12)
    const file = videoFile('huge.mp4', 'video/mp4', 600 * 1024 * 1024)

    await expect(prepareVideoForUpload(file, { readDuration })).rejects.toThrow(
      videoSourceTooLargeMessage(file.size),
    )
    expect(readDuration).not.toHaveBeenCalled()
  })

  it('debería aceptar un clip HD de 22 MB si dura 30 s o menos', async () => {
    const compress = vi.fn()
    const file = videoFile('terraza.mp4', 'video/mp4', 22 * 1024 * 1024)
    const prepared = await prepareVideoForUpload(file, {
      readDuration: async () => 22,
      compress,
    })
    expect(prepared).toBe(file)
    expect(compress).not.toHaveBeenCalled()
  })

  it('debería comprimir un 4K de 223 MB a un clip publicable', async () => {
    const original = videoFile('4k.mp4', 'video/mp4', 223 * 1024 * 1024)
    const compressed = videoFile('clip-adelia.mp4', 'video/mp4', 12 * 1024 * 1024)
    const phases: string[] = []

    const prepared = await prepareVideoForUpload(original, {
      readDuration: async () => 24,
      onPhase: (phase) => phases.push(phase),
      compress: async () => compressed,
    })

    expect(prepared).toBe(compressed)
    expect(phases).toEqual(['checking', 'compressing', 'ready'])
  })

  it('debería recortar a 30 s un vídeo largo y comprimirlo', async () => {
    const original = videoFile('tour.mp4', 'video/mp4', 80 * 1024 * 1024)
    const compressed = videoFile('clip-adelia.webm', 'video/webm', 9 * 1024 * 1024)
    const compress = vi.fn(async () => compressed)

    const prepared = await prepareVideoForUpload(original, {
      readDuration: async () => 180,
      compress,
    })

    expect(prepared).toBe(compressed)
    expect(compress).toHaveBeenCalled()
  })

  it('debería explicar el fallo si el navegador no puede comprimir', async () => {
    const file = videoFile('4k.mp4', 'video/mp4', 280 * 1024 * 1024)

    await expect(
      prepareVideoForUpload(file, {
        readDuration: async () => 20,
        compress: async () => {
          throw new Error('MediaRecorder missing')
        },
      }),
    ).rejects.toThrow(videoCompressFailedMessage(file.size))
  })

  it('debería rechazar el clip si tras comprimir sigue pesando más de 40 MB', async () => {
    const original = videoFile('4k.mp4', 'video/mp4', 223 * 1024 * 1024)
    const stillHeavy = videoFile('clip-adelia.webm', 'video/webm', 52 * 1024 * 1024)

    await expect(
      prepareVideoForUpload(original, {
        readDuration: async () => 20,
        compress: async () => stillHeavy,
      }),
    ).rejects.toThrow(videoTooHeavyMessage(stillHeavy.size))
  })
})
