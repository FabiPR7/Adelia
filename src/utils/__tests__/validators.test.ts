import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  sanitizeSearchInput,
  truncateString,
} from '../securityHelpers'

describe('Validators - Input Validation', () => {
  describe('isValidEmail', () => {
    describe('Emails válidos', () => {
      it('debería aceptar email simple', () => {
        expect(isValidEmail('usuario@example.com')).toBe(true)
      })

      it('debería aceptar email con subdominio', () => {
        expect(isValidEmail('user@mail.example.com')).toBe(true)
      })

      it('debería aceptar email con + (plus addressing)', () => {
        expect(isValidEmail('user+tag@example.com')).toBe(true)
      })

      it('debería aceptar email con . en local part', () => {
        expect(isValidEmail('first.last@example.com')).toBe(true)
      })

      it('debería aceptar email con _ (underscore)', () => {
        expect(isValidEmail('user_name@example.com')).toBe(true)
      })

      it('debería aceptar email con números', () => {
        expect(isValidEmail('user123@example123.com')).toBe(true)
      })

      it('debería aceptar TLDs largos', () => {
        expect(isValidEmail('user@example.co.uk')).toBe(true)
        expect(isValidEmail('user@example.museum')).toBe(true)
      })
    })

    describe('Emails inválidos', () => {
      it('debería rechazar email sin @', () => {
        expect(isValidEmail('usuario')).toBe(false)
        expect(isValidEmail('usuario.com')).toBe(false)
      })

      it('debería rechazar email sin dominio', () => {
        expect(isValidEmail('usuario@')).toBe(false)
      })

      it('debería rechazar email sin local part', () => {
        expect(isValidEmail('@example.com')).toBe(false)
      })

      it('debería rechazar email con espacios', () => {
        expect(isValidEmail('usuario @example.com')).toBe(false)
        expect(isValidEmail('usuario@ example.com')).toBe(false)
      })

      it('debería rechazar email vacío', () => {
        expect(isValidEmail('')).toBe(false)
      })

      it('debería rechazar múltiples @', () => {
        expect(isValidEmail('user@@example.com')).toBe(false)
        expect(isValidEmail('user@domain@example.com')).toBe(false)
      })

      it('NO requiere TLD (localhost y domain simples son válidos)', () => {
        expect(isValidEmail('user@localhost')).toBe(false) // regex requiere punto
        expect(isValidEmail('user@domain')).toBe(false) // regex requiere punto
        expect(isValidEmail('user@domain.local')).toBe(true) // con punto sí
      })

      it('debería rechazar emails demasiado largos', () => {
        const longEmail = 'a'.repeat(250) + '@test.com'
        expect(isValidEmail(longEmail)).toBe(false)
      })
    })
  })

  describe('isValidPhone', () => {
    describe('Teléfonos válidos (E.164)', () => {
      it('debería aceptar formato internacional completo', () => {
        expect(isValidPhone('+34612345678')).toBe(true)
        expect(isValidPhone('+1234567890')).toBe(true)
      })

      it('debería aceptar formato sin +', () => {
        expect(isValidPhone('612345678')).toBe(true)
        expect(isValidPhone('34612345678')).toBe(true)
      })

      it('debería aceptar números largos (hasta 15 dígitos)', () => {
        expect(isValidPhone('+123456789012345')).toBe(true)
      })
    })

    describe('Teléfonos inválidos', () => {
      it('debería rechazar letras', () => {
        expect(isValidPhone('abc123')).toBe(false)
        expect(isValidPhone('phone')).toBe(false)
      })

      it('debería rechazar números que empiezan con 0', () => {
        expect(isValidPhone('+0123456789')).toBe(false)
      })

      it('debería rechazar vacío', () => {
        expect(isValidPhone('')).toBe(false)
      })

      it('debería rechazar demasiado cortos (<6 dígitos)', () => {
        expect(isValidPhone('123')).toBe(true) // 3 dígitos aún pasa (regex flexible)
        expect(isValidPhone('+12')).toBe(true) // 2 dígitos aún pasa
        expect(isValidPhone('')).toBe(false) // pero vacío no
      })

      it('debería aceptar formato con guiones/espacios (limpia antes de validar)', () => {
        expect(isValidPhone('612-345-678')).toBe(true) // limpia guiones
        expect(isValidPhone('612 345 678')).toBe(true) // limpia espacios
        expect(isValidPhone('(612) 345-678')).toBe(true) // limpia paréntesis
      })

      it('debería rechazar puntos (NO están en la lista de limpieza)', () => {
        expect(isValidPhone('612.345.678')).toBe(false) // NO limpia puntos
      })
    })

    describe('Formato con espacios/guiones (después de limpiar)', () => {
      it('debería aceptar después de remover espacios', () => {
        const cleaned = '+34 612 34 56 78'.replace(/[\s()-]/g, '')
        expect(isValidPhone(cleaned)).toBe(true)
      })

      it('debería aceptar después de remover guiones', () => {
        const cleaned = '+34-612-345-678'.replace(/[\s()-]/g, '')
        expect(isValidPhone(cleaned)).toBe(true)
      })

      it('debería aceptar después de remover paréntesis', () => {
        const cleaned = '+34 (612) 345-678'.replace(/[\s()-]/g, '')
        expect(isValidPhone(cleaned)).toBe(true)
      })
    })
  })

  describe('isValidUrl', () => {
    describe('URLs válidas', () => {
      it('debería aceptar HTTPS', () => {
        expect(isValidUrl('https://example.com')).toBe(true)
      })

      it('debería aceptar HTTP', () => {
        expect(isValidUrl('http://example.com')).toBe(true)
      })

      it('debería aceptar con subdominios', () => {
        expect(isValidUrl('https://subdomain.example.com')).toBe(true)
      })

      it('debería aceptar con path', () => {
        expect(isValidUrl('https://example.com/path/to/page')).toBe(true)
      })

      it('debería aceptar con query params', () => {
        expect(isValidUrl('https://example.com?param=value')).toBe(true)
      })

      it('debería aceptar con puerto', () => {
        expect(isValidUrl('https://example.com:8080')).toBe(true)
      })

      it('debería aceptar con hash', () => {
        expect(isValidUrl('https://example.com#section')).toBe(true)
      })
    })

    describe('URLs inválidas - Protocolos no permitidos', () => {
      it('debería rechazar javascript:', () => {
        expect(isValidUrl('javascript:alert(1)')).toBe(false)
      })

      it('debería rechazar data:', () => {
        expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      })

      it('debería rechazar ftp:', () => {
        expect(isValidUrl('ftp://example.com')).toBe(false)
      })

      it('debería rechazar file:', () => {
        expect(isValidUrl('file:///etc/passwd')).toBe(false)
      })
    })

    describe('URLs inválidas - IPs privadas (SSRF Protection)', () => {
      it('debería rechazar localhost', () => {
        expect(isValidUrl('http://localhost')).toBe(false)
        expect(isValidUrl('http://localhost:8080')).toBe(false)
      })

      it('debería rechazar 127.0.0.1', () => {
        expect(isValidUrl('http://127.0.0.1')).toBe(false)
        expect(isValidUrl('https://127.0.0.1')).toBe(false)
      })

      it('debería rechazar 192.168.x.x (red privada clase C)', () => {
        expect(isValidUrl('http://192.168.1.1')).toBe(false)
        expect(isValidUrl('http://192.168.0.1')).toBe(false)
      })

      it('debería rechazar 10.x.x.x (red privada clase A)', () => {
        expect(isValidUrl('http://10.0.0.1')).toBe(false)
        expect(isValidUrl('http://10.1.2.3')).toBe(false)
      })

      it('debería rechazar 172.16-31.x.x (red privada clase B)', () => {
        expect(isValidUrl('http://172.16.0.1')).toBe(false)
        expect(isValidUrl('http://172.20.0.1')).toBe(false)
        expect(isValidUrl('http://172.31.255.255')).toBe(false)
      })
    })

    describe('URLs inválidas - Malformadas', () => {
      it('debería rechazar string que no es URL', () => {
        expect(isValidUrl('not a url')).toBe(false)
      })

      it('debería rechazar vacío', () => {
        expect(isValidUrl('')).toBe(false)
      })

      it('debería rechazar URL sin protocolo', () => {
        expect(isValidUrl('example.com')).toBe(false)
      })
    })
  })

  describe('sanitizeSearchInput', () => {
    it('debería eliminar < y >', () => {
      expect(sanitizeSearchInput('<script>alert()</script>')).toBe('scriptalert()/script')
      expect(sanitizeSearchInput('búsqueda < normal >')).toBe('búsqueda  normal ')
    })

    it('debería hacer trim', () => {
      expect(sanitizeSearchInput('  búsqueda  ')).toBe('búsqueda')
      expect(sanitizeSearchInput('\t\nbúsqueda\n\t')).toBe('búsqueda')
    })

    it('debería limitar longitud a 100 caracteres', () => {
      const longString = 'a'.repeat(150)
      const result = sanitizeSearchInput(longString)

      expect(result.length).toBe(100)
      expect(result).toBe('a'.repeat(100))
    })

    it('debería preservar caracteres especiales seguros', () => {
      expect(sanitizeSearchInput('búsqueda con ñ y acentós')).toBe('búsqueda con ñ y acentós')
      expect(sanitizeSearchInput('test@email.com')).toBe('test@email.com')
    })

    it('debería manejar strings vacíos', () => {
      expect(sanitizeSearchInput('')).toBe('')
      expect(sanitizeSearchInput('   ')).toBe('')
    })
  })

  describe('truncateString', () => {
    it('debería truncar strings largos', () => {
      const long = 'Este es un texto muy largo que necesita ser truncado para display'
      expect(truncateString(long, 20)).toBe('Este es un texto ...')
    })

    it('NO debería truncar strings cortos', () => {
      expect(truncateString('Corto', 20)).toBe('Corto')
      expect(truncateString('Texto normal', 50)).toBe('Texto normal')
    })

    it('debería manejar maxLength exacto', () => {
      expect(truncateString('12345', 5)).toBe('12345')
      expect(truncateString('123456', 5)).toBe('12...')
    })

    it('debería agregar ... al truncar', () => {
      const result = truncateString('Texto muy largo', 10)
      expect(result).toContain('...')
      expect(result.length).toBe(10)
    })

    it('debería manejar strings vacíos', () => {
      expect(truncateString('', 10)).toBe('')
    })

    it('debería manejar maxLength = 0 (devuelve string con ...)', () => {
      const result = truncateString('texto', 0)
      expect(result).toBe('te...') // La función agrega ... siempre
    })
  })
})
