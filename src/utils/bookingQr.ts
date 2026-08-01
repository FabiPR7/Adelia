export async function downloadBookingQrCode(url: string, filename: string) {
  const { default: QRCode } = await import('qrcode')

  const dataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#5c4a3a',
      light: '#ffffff',
    },
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
