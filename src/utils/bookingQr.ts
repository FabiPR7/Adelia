interface BrandedQrOptions {
  /** @deprecated Usa BrandedQrRenderOptions vía resolveBrandedQrOptions. */
  subtitle?: string
}

export interface BrandedQrRenderOptions {
  logoUrl?: string | null
  title?: string | null
  subtitle?: string | null
  darkColor?: string
  subtitleColor?: string
}

function isCrossOriginUrl(src: string): boolean {
  if (!/^https?:\/\//i.test(src)) {
    return false
  }

  try {
    return new URL(src).origin !== window.location.origin
  } catch {
    return false
  }
}

function loadImageElement(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    if (crossOrigin) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una imagen del QR.'))
    img.src = src
  })
}

async function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  if (isCrossOriginUrl(src)) {
    try {
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' })

      if (response.ok) {
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        try {
          return await loadImageElement(objectUrl)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
    } catch {
      // Intentamos cargar la URL remota con CORS en el elemento img.
    }

    return loadImageElement(src, true)
  }

  return loadImageElement(src)
}

function resolveRenderOptions(
  legacyOptions: BrandedQrOptions | undefined,
  renderOptions?: BrandedQrRenderOptions,
): BrandedQrRenderOptions {
  if (renderOptions) {
    return renderOptions
  }

  return {
    logoUrl: '/adelia-logo.webp',
    title: 'Adelia',
    subtitle: legacyOptions?.subtitle?.trim() || null,
    darkColor: '#5c4a3a',
    subtitleColor: '#8b7355',
  }
}

export async function buildBrandedQrDataUrl(
  url: string,
  renderOptions?: BrandedQrRenderOptions,
  legacyOptions?: BrandedQrOptions,
): Promise<string> {
  const { default: QRCode } = await import('qrcode')
  const options = resolveRenderOptions(legacyOptions, renderOptions)

  const qrSize = 400
  const padding = 36
  const logoSize = 58
  const titleLineHeight = options.title ? 28 : 0
  const subtitleLineHeight = options.subtitle ? 22 : 0
  const logoBlockHeight = options.logoUrl ? logoSize : 0
  const sectionGap = 14

  const canvasWidth = qrSize + padding * 2
  const canvasHeight =
    padding
    + logoBlockHeight
    + (logoBlockHeight ? sectionGap : 0)
    + titleLineHeight
    + (titleLineHeight && subtitleLineHeight ? sectionGap : 0)
    + subtitleLineHeight
    + (titleLineHeight || subtitleLineHeight || logoBlockHeight ? sectionGap : 0)
    + qrSize
    + padding

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo crear la imagen del QR.')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  let cursorY = padding

  if (options.logoUrl) {
    const logo = await loadCanvasImage(options.logoUrl)
    ctx.drawImage(logo, (canvasWidth - logoSize) / 2, cursorY, logoSize, logoSize)
    cursorY += logoSize + sectionGap
  }

  if (options.title) {
    ctx.fillStyle = options.darkColor || '#5c4a3a'
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(options.title, canvasWidth / 2, cursorY + titleLineHeight / 2)
    cursorY += titleLineHeight
  }

  if (options.subtitle) {
    if (options.title) {
      cursorY += sectionGap
    }

    ctx.fillStyle = options.subtitleColor || '#8b7355'
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(options.subtitle, canvasWidth / 2, cursorY + subtitleLineHeight / 2)
    cursorY += subtitleLineHeight
  }

  if (options.logoUrl || options.title || options.subtitle) {
    cursorY += sectionGap
  }

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: options.darkColor || '#5c4a3a',
      light: '#ffffff',
    },
  })

  const qrImage = await loadCanvasImage(qrDataUrl)
  ctx.drawImage(qrImage, padding, cursorY, qrSize, qrSize)

  return canvas.toDataURL('image/png')
}

export async function downloadBookingQrCode(
  url: string,
  filename: string,
  renderOptions?: BrandedQrRenderOptions,
  legacyOptions?: BrandedQrOptions,
) {
  const dataUrl = await buildBrandedQrDataUrl(url, renderOptions, legacyOptions)

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
