# 🍽️ Adelia - Restaurant Management Platform

![Tests](https://github.com/FabiPR7/Adelia/workflows/Tests/badge.svg)

Plataforma completa de gestión de restaurantes con sistema de reservas, gamificación de clientes, y analytics avanzados.

---

## ✨ Features

### Para Restaurantes
- 📊 **Dashboard Administrativo** con KPIs y analytics en tiempo real
- 📅 **Sistema de Reservas** con prevención de overbooking (transacciones atómicas)
- 🎮 **Gamificación** para fidelizar clientes
- 💳 **Planes con Lemon Squeezy** y fianzas de reserva con Stripe Connect
- 📱 **Gestión de Menús** con importación/exportación Excel
- 📍 **Geolocalización** con mapas interactivos
- 📧 **Sistema de Notificaciones** email/push

### Para Clientes
- 🔍 **Descubrimiento** de restaurantes cercanos
- ⭐ **Sistema de Reviews** con etiquetado de productos/promociones
- 🎯 **Programa de Puntos** y niveles de fidelidad
- 🎁 **Promociones** y descuentos personalizados
- 📖 **Reservas Online** con confirmación automática

---

## 🛡️ Security

Prácticas de seguridad aplicadas (revisadas internamente, sin auditoría externa):

- ✅ **XSS Protection** con DOMPurify
- ✅ **Mass Assignment Prevention** con whitelists
- ✅ **File Upload Validation** (5MB, tipos, dimensiones)
- ✅ **reCAPTCHA v3** anti-bot protection
- ✅ **Rate Limiting** + Account Lockout (5 intentos = 15 min)
- ✅ **Transacciones Atómicas** previene race conditions
- ✅ **SSRF Protection** validación de URLs
- ✅ **Input Sanitization** en todos los inputs
- ✅ **Error Handling** no verbose (no information disclosure)

### Testing

- Suite de tests con Vitest (unitarios de seguridad, slots de reserva y utilidades)
- **CI/CD** con GitHub Actions

---

## 🚀 Tech Stack

### Frontend
- **React 19** + TypeScript
- **Vite** para build ultrarrápido
- **Firebase Auth** para autenticación
- **Firestore** como base de datos
- **Leaflet** para mapas
- **DOMPurify** para XSS protection
- **Vitest** para testing

### Backend
- **Firebase Cloud Functions** (Node.js)
- **Firebase Admin SDK** para operaciones privilegiadas
- **Express** como API, desplegada como Cloud Function
- **Lemon Squeezy** para los planes y **Stripe Connect** para las fianzas
- **reCAPTCHA v3** para anti-bot
- **Transacciones Atómicas** de Firestore

### DevOps
- **GitHub Actions** para CI/CD
- **Firebase Hosting** para deployment
- **Codecov** para coverage reports
- **Snyk** para security scanning

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/FabiPR7/Adelia.git
cd Adelia

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase keys

# Run development server
npm run dev
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests once (CI/CD)
npm run test:run

# Generate coverage report
npm run test:coverage

# Watch mode (development)
npm run test:watch

# Visual UI
npm run test:ui
```

Ejecuta `npm run test:coverage` para ver el informe de cobertura actualizado.

---

## 🏗️ Project Structure

```
adelia/
├── src/                    # Landing, app de clientes, panel de empresa y admin
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── utils/
├── server/                 # API Express
│   ├── routes/
│   ├── gamification/
│   ├── lemonsqueezy/       # Planes de restaurante
│   └── stripe/             # Fianzas (Connect)
├── functions/              # Cloud Functions: API, triggers y tareas programadas
│   └── src/
├── .github/
│   └── workflows/
│       └── test.yml        # CI/CD pipeline
└── firestore.rules         # Security rules
```

---

## 🔐 Security Features

### Authentication
- ✅ Firebase Auth con bcrypt hashing
- ✅ Strong password requirements
- ✅ Account lockout (5 intentos = 15 min)
- ✅ Rate limiting en login
- ✅ Unified error messages (no user enumeration)

### Authorization
- ✅ Firestore Rules (server-side)
- ✅ Role-based access control (admin/company/customer)
- ✅ Security logging de intentos no autorizados

### Data Protection
- ✅ Input sanitization en todos los inputs
- ✅ XSS protection con DOMPurify
- ✅ SSRF protection (no IPs privadas)
- ✅ Mass assignment prevention (whitelists)

### Anti-Bot
- ✅ reCAPTCHA v3 en registro
- ✅ Score thresholds configurables

### Operational Security
- ✅ Error handling no verbose
- ✅ Random delays anti-timing attacks

---

## 🚀 Deployment

Publica hosting, API y reglas a la vez: dependen entre sí. Si cambian las misiones
o los niveles, ejecuta antes `npm run seed-game-catalog`.

```bash
# Comprobar tipos de frontend y servidor
npm run typecheck

# Build for production
npm run build

# Deploy to Firebase
npm run deploy

# Deploy only hosting
npm run deploy:hosting

# Deploy only functions
npm run deploy:api

# Deploy only Firestore rules
npm run deploy:rules
```

---

## 📚 Documentation

- [Testing Guide](./TESTING_GUIDE.md) - Cómo ejecutar y añadir tests
- [Security Hardening](./SECURITY_HARDENING_COMPLETE.md) - Todas las mejoras de seguridad
- [Pentesting Audit](./PENTESTING_COMPLETE_AUDIT.md) - Auditoría OWASP Top 10
- [Implementation Guide](./IMPLEMENTATION_GUIDE_10_10.md) - Guía de implementación nivel 10/10
- [Migration Backend Security](./MIGRATION_BACKEND_SECURITY.md) - Migración a Cloud Functions

---

## 🏆 Cumplimiento

El diseño busca alinearse con OWASP Top 10 y con los principios de GDPR
(minimización de datos, trazabilidad de accesos). **No hay ninguna certificación
externa (SOC 2, ISO 27001, PCI DSS) obtenida**; los pagos con tarjeta se delegan
en Lemon Squeezy y Stripe, por lo que la aplicación no almacena datos de tarjeta.

---

## 👥 Contributors

- **Fabián** - Lead Developer
- **AI Assistant** - Security & Testing Implementation

---

## 🔗 Links

- **Web**: https://adeliareservas.com

---

**Made with ❤️ in Spain**
