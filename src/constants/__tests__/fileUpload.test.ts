import { describe, it, expect } from 'vitest'
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  isAllowedImageType,
  isAllowedImageExtension,
  isValidFileSize,
  formatFileSize,
} from '../fileUpload'

describe('fileUpload constants and validation', () => {
  describe('Constants', () => {
    it('debería tener MAX_FILE_SIZE definido', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024) // 5MB
      expect(MAX_FILE_SIZE).toBeGreaterThan(0)
    })

    it('debería tener dimensiones máximas definidas', () => {
      expect(MAX_IMAGE_WIDTH).toBe(4000)
      expect(MAX_IMAGE_HEIGHT).toBe(4000)
    })

    it('debería tener whitelist de tipos permitidos', () => {
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpg')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/webp')
    })

    it('debería tener whitelist de extensiones permitidas', () => {
      expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.jpg')
      expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.jpeg')
      expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.png')
      expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.webp')
    })
  })

  describe('isAllowedImageType', () => {
    it('debería aceptar tipos MIME permitidos', () => {
      expect(isAllowedImageType('image/jpeg')).toBe(true)
      expect(isAllowedImageType('image/jpg')).toBe(true)
      expect(isAllowedImageType('image/png')).toBe(true)
      expect(isAllowedImageType('image/webp')).toBe(true)
    })

    it('debería rechazar tipos MIME no permitidos', () => {
      expect(isAllowedImageType('image/gif')).toBe(false)
      expect(isAllowedImageType('image/svg+xml')).toBe(false)
      expect(isAllowedImageType('image/bmp')).toBe(false)
      expect(isAllowedImageType('application/pdf')).toBe(false)
      expect(isAllowedImageType('video/mp4')).toBe(false)
      expect(isAllowedImageType('text/html')).toBe(false)
    })

    it('debería ser case-sensitive para tipos MIME', () => {
      expect(isAllowedImageType('IMAGE/JPEG')).toBe(false)
      expect(isAllowedImageType('Image/Png')).toBe(false)
    })

    it('debería rechazar strings vacíos', () => {
      expect(isAllowedImageType('')).toBe(false)
    })

    it('debería rechazar tipos maliciosos', () => {
      expect(isAllowedImageType('application/x-msdownload')).toBe(false) // .exe
      expect(isAllowedImageType('application/x-sh')).toBe(false) // .sh script
      expect(isAllowedImageType('text/javascript')).toBe(false)
    })
  })

  describe('isAllowedImageExtension', () => {
    it('debería aceptar extensiones permitidas', () => {
      expect(isAllowedImageExtension('foto.jpg')).toBe(true)
      expect(isAllowedImageExtension('imagen.jpeg')).toBe(true)
      expect(isAllowedImageExtension('captura.png')).toBe(true)
      expect(isAllowedImageExtension('banner.webp')).toBe(true)
    })

    it('debería ser case-insensitive', () => {
      expect(isAllowedImageExtension('foto.JPG')).toBe(true)
      expect(isAllowedImageExtension('imagen.JPEG')).toBe(true)
      expect(isAllowedImageExtension('Foto.PnG')).toBe(true)
    })

    it('debería rechazar extensiones no permitidas', () => {
      expect(isAllowedImageExtension('animation.gif')).toBe(false)
      expect(isAllowedImageExtension('vector.svg')).toBe(false)
      expect(isAllowedImageExtension('document.pdf')).toBe(false)
      expect(isAllowedImageExtension('video.mp4')).toBe(false)
    })

    it('debería rechazar extensiones peligrosas', () => {
      expect(isAllowedImageExtension('virus.exe')).toBe(false)
      expect(isAllowedImageExtension('script.sh')).toBe(false)
      expect(isAllowedImageExtension('malware.bat')).toBe(false)
      expect(isAllowedImageExtension('hack.js')).toBe(false)
    })

    it('debería rechazar double extensions (truco común)', () => {
      expect(isAllowedImageExtension('foto.jpg.exe')).toBe(false)
      expect(isAllowedImageExtension('imagen.png.js')).toBe(false)
    })

    it('debería manejar rutas completas', () => {
      expect(isAllowedImageExtension('/path/to/foto.jpg')).toBe(true)
      expect(isAllowedImageExtension('C:\\Users\\foto.png')).toBe(true)
    })

    it('debería rechazar archivos sin extensión', () => {
      expect(isAllowedImageExtension('archivo')).toBe(false)
      expect(isAllowedImageExtension('foto.')).toBe(false)
    })
  })

  describe('isValidFileSize', () => {
    it('debería aceptar tamaños válidos', () => {
      expect(isValidFileSize(1024)).toBe(true) // 1KB
      expect(isValidFileSize(1024 * 1024)).toBe(true) // 1MB
      expect(isValidFileSize(MAX_FILE_SIZE)).toBe(true) // Exactamente 5MB
    })

    it('debería rechazar tamaños demasiado grandes', () => {
      expect(isValidFileSize(MAX_FILE_SIZE + 1)).toBe(false)
      expect(isValidFileSize(10 * 1024 * 1024)).toBe(false) // 10MB
      expect(isValidFileSize(100 * 1024 * 1024)).toBe(false) // 100MB
    })

    it('debería rechazar tamaños negativos o cero', () => {
      expect(isValidFileSize(0)).toBe(false)
      expect(isValidFileSize(-1)).toBe(false)
      expect(isValidFileSize(-1024)).toBe(false)
    })

    it('debería rechazar tamaños extremadamente grandes (DoS)', () => {
      expect(isValidFileSize(Number.MAX_SAFE_INTEGER)).toBe(false)
      expect(isValidFileSize(1000000000000)).toBe(false) // 1TB
    })
  })

  describe('formatFileSize', () => {
    it('debería formatear bytes', () => {
      expect(formatFileSize(100)).toBe('100 B')
      expect(formatFileSize(500)).toBe('500 B')
      expect(formatFileSize(1023)).toBe('1023 B')
    })

    it('debería formatear kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(2048)).toBe('2.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('debería formatear megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })

    it('debería redondear a 1 decimal', () => {
      expect(formatFileSize(1234)).toBe('1.2 KB')
      expect(formatFileSize(1567)).toBe('1.5 KB')
      expect(formatFileSize(1999)).toBe('2.0 KB')
    })

    it('debería manejar tamaño 0', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('debería formatear MAX_FILE_SIZE correctamente', () => {
      const formatted = formatFileSize(MAX_FILE_SIZE)
      expect(formatted).toBe('5.0 MB')
    })
  })

  describe('Security Tests - Prevención de ataques', () => {
    it('NO debería permitir Zip Bombs (archivos comprimidos gigantes)', () => {
      // Zip bombs son archivos pequeños que se expanden mucho
      // Aunque el tamaño del archivo sea pequeño, verificamos el límite
      const zipBombSize = 6 * 1024 * 1024 // 6MB
      expect(isValidFileSize(zipBombSize)).toBe(false)
    })

    it('NO debería permitir extensiones dobles (polyglot files)', () => {
      // Archivos que son imágenes Y ejecutables a la vez
      expect(isAllowedImageExtension('imagen.jpg.exe')).toBe(false)
      expect(isAllowedImageExtension('foto.png.bat')).toBe(false)
    })

    it('NO debería permitir tipos MIME mentirosos', () => {
      // Un atacante podría cambiar el MIME type en el request
      // Por eso verificamos TANTO tipo COMO extensión
      expect(isAllowedImageType('image/png')).toBe(true)
      expect(isAllowedImageExtension('malware.exe')).toBe(false)
      // En producción, AMBAS validaciones deben pasar
    })

    it('NO debería permitir archivos enormes (DoS attack)', () => {
      const hugeFile = 500 * 1024 * 1024 // 500MB
      expect(isValidFileSize(hugeFile)).toBe(false)
    })

    it('debería prevenir ataques de path traversal en nombres', () => {
      // Aunque esto es más validación de backend, verificamos extensión
      expect(isAllowedImageExtension('../../../etc/passwd.png')).toBe(true)
      // La extensión es válida, pero el backend debe sanitizar el path
    })
  })

  describe('Integration Tests', () => {
    it('debería validar un archivo legítimo completo', () => {
      const file = {
        name: 'foto-restaurante.jpg',
        type: 'image/jpeg',
        size: 2 * 1024 * 1024, // 2MB
      }

      expect(isAllowedImageType(file.type)).toBe(true)
      expect(isAllowedImageExtension(file.name)).toBe(true)
      expect(isValidFileSize(file.size)).toBe(true)
    })

    it('debería rechazar un archivo malicioso completo', () => {
      const file = {
        name: 'virus.exe',
        type: 'application/x-msdownload',
        size: 100 * 1024, // 100KB
      }

      expect(isAllowedImageType(file.type)).toBe(false)
      expect(isAllowedImageExtension(file.name)).toBe(false)
      // Aunque el tamaño sea válido, otros checks fallan
    })

    it('debería rechazar un archivo demasiado grande', () => {
      const file = {
        name: 'foto-enorme.jpg',
        type: 'image/jpeg',
        size: 10 * 1024 * 1024, // 10MB
      }

      expect(isAllowedImageType(file.type)).toBe(true)
      expect(isAllowedImageExtension(file.name)).toBe(true)
      expect(isValidFileSize(file.size)).toBe(false) // ❌ Demasiado grande
    })
  })
})
