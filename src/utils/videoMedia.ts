import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_SIZE,
  MAX_VIDEO_SOURCE_FILE_SIZE,
  formatFileSize,
  formatVideoDurationLimit,
  isAllowedVideoFile,
  isValidVideoFileSize,
  isVideoDurationAllowed,
} from '../constants/fileUpload'

export type VideoPreparePhase = 'checking' | 'compressing' | 'ready'

export const VIDEO_COMPRESS_MAX_EDGE = 1280
export const VIDEO_COMPRESS_BITRATE = 2_400_000
const MIN_COMPRESSED_VIDEO_BYTES = 40 * 1024

type CompressVideoFn = (
  file: File,
  options?: {
    durationSeconds?: number
    onProgress?: (percent: number) => void
  },
) => Promise<File>

interface PrepareVideoOptions {
  onPhase?: (phase: VideoPreparePhase) => void
  onCompressProgress?: (percent: number) => void
  readDuration?: (file: File) => Promise<number>
  compress?: CompressVideoFn
}

function videoFileError(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!isAllowedVideoFile(file)) {
    return 'Usa un vídeo MP4, MOV o WebM. No se admiten películas ni formatos raros.'
  }

  return null
}

export function videoTooLongMessage(durationSeconds: number): string {
  const seconds = Math.round(durationSeconds)
  return `El vídeo dura ${seconds} s. El máximo es ${formatVideoDurationLimit()} para que el perfil no se convierta en un cine.`
}

export function videoTooHeavyMessage(sizeBytes: number): string {
  return `El vídeo pesa ${formatFileSize(sizeBytes)}. El máximo al publicar es ${formatFileSize(MAX_VIDEO_FILE_SIZE)}.`
}

export function videoSourceTooLargeMessage(sizeBytes: number): string {
  return `El vídeo pesa ${formatFileSize(sizeBytes)}. Para poder comprimirlo, el original no puede pasar de ${formatFileSize(MAX_VIDEO_SOURCE_FILE_SIZE)}.`
}

export function videoCompressFailedMessage(sizeBytes: number): string {
  return `Este archivo pesa ${formatFileSize(sizeBytes)}. Adelia puede dejarlo en un clip HD de ${formatVideoDurationLimit()}, pero este navegador no ha podido comprimirlo. Prueba en Chrome en el ordenador, o expórtalo en 720p.`
}

export function fitVideoFrame(
  width: number,
  height: number,
  maxEdge = VIDEO_COMPRESS_MAX_EDGE,
): { width: number; height: number } {
  const safeWidth = width > 0 ? width : 1280
  const safeHeight = height > 0 ? height : 720
  const longEdge = Math.max(safeWidth, safeHeight)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  const even = (value: number) => Math.max(2, Math.round(value * scale) - (Math.round(value * scale) % 2))

  return {
    width: even(safeWidth),
    height: even(safeHeight),
  }
}

export function clipRecordSeconds(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return MAX_VIDEO_DURATION_SECONDS
  }

  return Math.min(durationSeconds, MAX_VIDEO_DURATION_SECONDS)
}

export function needsVideoCompression(sizeBytes: number, durationSeconds: number): boolean {
  return !isValidVideoFileSize(sizeBytes) || !isVideoDurationAllowed(durationSeconds)
}

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }

  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export async function readVideoDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const fail = () => {
        reject(new Error('No se pudo leer el vídeo. Prueba un MP4 o MOV.'))
      }
      const timer = window.setTimeout(fail, 20_000)

      video.addEventListener('error', fail, { once: true })
      video.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(video.duration) && video.duration > 0) {
            window.clearTimeout(timer)
            resolve(video.duration)
            return
          }

          const onTimeUpdate = () => {
            video.removeEventListener('timeupdate', onTimeUpdate)
            if (Number.isFinite(video.duration) && video.duration > 0) {
              window.clearTimeout(timer)
              resolve(video.duration)
              return
            }
            window.clearTimeout(timer)
            fail()
          }

          video.addEventListener('timeupdate', onTimeUpdate)
          try {
            video.currentTime = 1e10
          } catch {
            window.clearTimeout(timer)
            fail()
          }
        },
        { once: true },
      )

      video.src = objectUrl
    })

    return duration
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function attachAudioTrack(fromVideo: HTMLVideoElement, toStream: MediaStream) {
  const media = fromVideo as HTMLVideoElement & {
    captureStream?: () => MediaStream
    webkitCaptureStream?: () => MediaStream
  }
  const capture = media.captureStream ?? media.webkitCaptureStream
  if (typeof capture !== 'function') {
    return
  }

  try {
    const native = capture.call(fromVideo)
    native.getAudioTracks().forEach((track) => {
      toStream.addTrack(track)
    })
  } catch {
    // Algunos navegadores no dejan capturar audio a la vez.
  }
}

export async function compressRestaurantVideo(
  file: File,
  options: {
    durationSeconds?: number
    onProgress?: (percent: number) => void
  } = {},
): Promise<File> {
  const mimeType = pickRecorderMimeType()
  if (!mimeType || typeof document === 'undefined') {
    throw new Error(videoCompressFailedMessage(file.size))
  }

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.preload = 'auto'
  video.controls = false
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;opacity:0;pointer-events:none'
  canvas.style.cssText = video.style.cssText
  document.body.append(video, canvas)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    video.remove()
    canvas.remove()
    URL.revokeObjectURL(objectUrl)
    throw new Error(videoCompressFailedMessage(file.size))
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error(videoCompressFailedMessage(file.size)))
      const timer = window.setTimeout(fail, 60_000)
      const ok = () => {
        window.clearTimeout(timer)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(timer)
        fail()
      }
      video.onloadedmetadata = ok
      video.src = objectUrl
      if (video.readyState >= 1) {
        ok()
      }
    })

    const recordSeconds = clipRecordSeconds(options.durationSeconds ?? video.duration)
    const frame = fitVideoFrame(video.videoWidth, video.videoHeight)
    canvas.width = frame.width
    canvas.height = frame.height

    if (video.currentTime > 0.05) {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video.addEventListener('seeked', done, { once: true })
        video.currentTime = 0
        window.setTimeout(done, 800)
      })
    }

    try {
      await video.play()
    } catch {
      throw new Error(videoCompressFailedMessage(file.size))
    }

    const stream = canvas.captureStream(24)
    attachAudioTrack(video, stream)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_COMPRESS_BITRATE,
      audioBitsPerSecond: 96_000,
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error(videoCompressFailedMessage(file.size)))
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] }))
    })

    let frameId = 0
    let stopped = false
    const draw = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      if (!stopped) {
        frameId = window.requestAnimationFrame(draw)
      }
    }
    draw()
    recorder.start(200)

    await new Promise<void>((resolve) => {
      const finish = () => {
        video.removeEventListener('timeupdate', onTime)
        video.removeEventListener('ended', finish)
        window.clearTimeout(watchdog)
        resolve()
      }
      const onTime = () => {
        const percent = Math.min(99, Math.round((video.currentTime / recordSeconds) * 100))
        options.onProgress?.(percent)
        if (video.currentTime >= recordSeconds - 0.05) {
          finish()
        }
      }
      const watchdog = window.setTimeout(finish, Math.ceil(recordSeconds * 1000) + 2500)
      video.addEventListener('timeupdate', onTime)
      video.addEventListener('ended', finish, { once: true })
    })

    stopped = true
    window.cancelAnimationFrame(frameId)
    video.pause()
    if (recorder.state !== 'inactive') {
      recorder.stop()
    }

    const blob = await recorded
    stream.getTracks().forEach((track) => track.stop())
    if (blob.size < MIN_COMPRESSED_VIDEO_BYTES) {
      throw new Error(videoCompressFailedMessage(file.size))
    }

    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const compressed = new File([blob], `clip-adelia.${extension}`, {
      type: blob.type || mimeType.split(';')[0],
    })
    options.onProgress?.(100)
    return compressed
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()
    canvas.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function prepareVideoForUpload(
  file: File,
  options: PrepareVideoOptions = {},
): Promise<File> {
  const typeError = videoFileError(file)
  if (typeError) {
    throw new Error(typeError)
  }

  if (file.size > MAX_VIDEO_SOURCE_FILE_SIZE) {
    throw new Error(videoSourceTooLargeMessage(file.size))
  }

  options.onPhase?.('checking')
  const readDuration = options.readDuration ?? readVideoDurationSeconds
  const duration = await readDuration(file)
  const shouldCompress = needsVideoCompression(file.size, duration)

  if (!shouldCompress) {
    options.onPhase?.('ready')
    return file
  }

  options.onPhase?.('compressing')
  const compress = options.compress ?? compressRestaurantVideo

  try {
    const prepared = await compress(file, {
      durationSeconds: duration,
      onProgress: options.onCompressProgress,
    })

    if (!isValidVideoFileSize(prepared.size) || prepared.size < MIN_COMPRESSED_VIDEO_BYTES) {
      throw new Error(videoTooHeavyMessage(prepared.size))
    }

    options.onPhase?.('ready')
    return prepared
  } catch (error) {
    if (
      error instanceof Error
      && (error.message.includes('navegador no ha podido') || error.message.includes('máximo al publicar'))
    ) {
      throw error
    }

    throw new Error(videoCompressFailedMessage(file.size))
  }
}

export { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_FILE_SIZE, MAX_VIDEO_SOURCE_FILE_SIZE }
