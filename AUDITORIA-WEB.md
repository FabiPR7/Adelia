# Auditoría de la web (21 nov 2026)

Revisión punto por punto de seguridad, arquitectura, base de datos y rendimiento.
✅ revisado y bien · 🔧 arreglado en esta revisión · ⚠️ pendiente (con propuesta)

---

## 1. Seguridad

### 1.1 Quién puede llamar a cada ruta del servidor
- ✅ 46 grupos de rutas revisados. Las de restaurante comprueban que eres el dueño
  del local (`ensureCompanyOwner`); las de cliente, tu sesión (`verifyCustomerUid`);
  todo `/api/admin` pasa por `verifyAdmin`.
- ✅ El admin se verifica en el servidor con el rol guardado en la base de datos.
  Como las reglas no dejan escribir a ningún cliente, nadie puede darse el rol.
- ✅ Rutas públicas a propósito (catálogo, buscador, ficha, reservar sin cuenta,
  cancelar con su código, ciudades, mapas). Las que escriben llevan captcha y límite.
- ✅ Correos de reserva (`/api/reservations/:id/...`): comprueban permisos dentro.
- ✅ Webhooks de pago: Stripe valida la firma (`constructEvent`) y Lemon Squeezy con
  HMAC y comparación segura (`timingSafeEqual`).

### 1.2 Inyecciones y datos de entrada
- ✅ No hay SQL: la base de datos es Firestore, sin consultas de texto que inyectar.
- 🔧 **Rutas con barra codificada** (`%2F`, `%5C`, `%00`) o `..`: el servidor usaba los
  identificadores de la URL como rutas de la base de datos. Ahora se rechazan con 400
  (comprobado llamando al servidor directamente).
- ✅ `sanitizeRequest` limpia todo el cuerpo de cada petición: quita `__proto__`,
  `constructor`, claves con punto, caracteres de control; limita tamaños, número de
  claves y profundidad. JSON máximo 256 KB.
- ✅ Validación por ruta (`asSlug`, `asId`, `asInt`, `asDateYmd`…) y reglas comunes con
  la web (ajustes del local, promos, carta, PIN).
- ✅ XSS: la web no usa `dangerouslySetInnerHTML`; los correos escapan los datos del
  cliente (`escapeHtml`/`stripHtml`).

### 1.3 Reglas de Firestore
- ✅ Ningún cliente puede escribir: todo pasa por el servidor.
- ✅ Lecturas: cada usuario lo suyo; cada restaurante lo suyo; el admin todo.
- 🔧 `appConfig` era de lectura pública entera y tenía la configuración de seguridad
  (umbrales del captcha). Ahora solo `billing` y `planCapabilities` son públicos.
- ✅ Catálogos del juego y planes: lectura pública a propósito (no tienen secretos).

### 1.4 Cabeceras, CORS y abuso
- ✅ CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` (web y servidor).
- ✅ CORS solo para los dominios de Adelia.
- ✅ Límite general por IP y límites propios en login, alta de restaurante, reservas,
  cancelaciones, PIN de promos, gasto mínimo, minijuegos y envío de correos.
- ✅ Subidas a Cloudinary firmadas por el servidor: carpeta, formatos y caducidad
  fijados por Adelia. Las de alta de restaurante (sin cuenta) van a su carpeta y con
  límite estricto.

### 1.5 Dependencias
- ✅ `@grpc/grpc-js` aparece en `npm audit`, pero la versión instalada (1.14.7) ya es
  la corregida: falso positivo.
- ⚠️ `xlsx` (importar/exportar la carta en Excel) tiene fallos conocidos sin arreglo en
  npm. Riesgo bajo: solo procesa archivos que sube el propio restaurante en su
  navegador. **Propuesta:** cambiar a la versión oficial de SheetJS (cdn.sheetjs.com)
  o a `exceljs`.

---

## 2. Arquitectura (lo que manda la base de datos)

- 🔧 **Misiones:** 51 reglas tenían el objetivo escrito en el código. Ahora todas usan
  el objetivo de la base de datos (lo que se cambie en el admin se aplica tal cual).
- 🔧 **Packs de la semana/mes:** reclamarlos exigía números fijos (5 misiones, 6 y 5
  huecos) aunque el motor usara los de la base de datos. Ahora usan los mismos.
- ✅ XP por reserva, bonus semanal, huecos de misiones, cancelación gratis, días de
  fianza, nombres de usuario, mapa gastronómico: vienen de `gameConfig` y
  `appConfig/businessRules`.
- ✅ Todas las escrituras de web y app van por la API; reservar, horas libres,
  misiones, promos, ranking y buscador los calcula el servidor.
- ⚠️ Constantes de los minijuegos (tiempos de turno, tamaño del laberinto…) siguen
  en el código. Son reglas del juego, no de negocio; se pueden pasar a `gameConfig`
  si se quiere ajustarlas sin publicar.

---

## 3. Base de datos

### 3.1 Consultas sin límite
- ✅ Servidor: todas las consultas a colecciones llevan límite o están acotadas (un día
  de un local, listas de 10 como máximo).
- ✅ Web: las 41 lecturas directas llevan límite.

### 3.2 Paginación
- ✅ Buscador por páginas de 80 con cursor; «Todos los restaurantes» pide la siguiente
  al llegar al final.
- ✅ Reseñas de la ficha de 10 en 10 con filtro en el servidor.
- ✅ Clientes del restaurante, reseñas del panel, eventos y reseñas del admin, por páginas.

### 3.3 Índices y cachés
- ✅ Índice nuevo de reseñas por nota + fecha (publicado).
- ✅ Los registros del servidor no muestran consultas fallidas por falta de índice.
- ✅ Cachés en memoria y en la CDN para lo público y lo que es igual para todos
  (listado, promos 2 min, ranking 2 min, reseñas destacadas 10 min, mapa 1 h).

---

## 4. Rendimiento de la web
- ✅ Las secciones de abajo de Explorar se cargan al llegar a ellas.
- ✅ Imágenes con carga diferida y tamaños de Cloudinary optimizados.
- ✅ Páginas cargadas bajo demanda (`lazy`) en el router.
- ⚠️ Las misiones se evalúan en el servidor en cada cambio de datos (con espera de
  1,2 s). Con muchos usuarios conviene guardar el resultado y recalcular solo al
  validar una visita o consumo.

---

## 5. Pendiente de decidir
1. Cambiar `xlsx` por la versión oficial o `exceljs` (1.5).
2. Pasar las constantes de minijuegos a `gameConfig` (2).
3. Evaluar misiones solo cuando entra una visita/consumo (4).
4. Borrar en producción la función vieja `processScheduledNotifications`.
