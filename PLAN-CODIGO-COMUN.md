# Código común web + app (lista maestra)

Objetivo: que las reglas del negocio vivan en un solo sitio (el servidor) y que la web
y la app solo pinten lo que el servidor decide. Así, lo que se arregla una vez queda
arreglado en las dos.

✅ hecho · 🔄 en curso · ⏳ pendiente

Situación de partida (20 nov 2026):
- Web (`Adelia/src`), app (`C:\adelia\src`) y servidor (`Adelia/server`) comparten
  servidor y base de datos.
- Pero hay **unas 60 piezas copiadas a mano** entre web y app (y algunas también en el
  servidor). Ejemplos: el motor de misiones (1.043 líneas, idéntico en las dos), el
  progreso «En curso» de promos (448), quién puede usar una promo (300), los bloqueos
  de promos por horario (228), las horas libres para reservar (196–271), la fianza,
  los modos de reserva (3 copias: web, app y servidor), los tipos de datos…
- La app lee y escribe algunas cosas directamente en la base de datos en vez de por la
  API (reservas, reseñas, premios, promos guardadas).

## Lista por prioridad

1. ✅ **Reservar: lo decide el servidor.** (20 nov) `server/reservations/bookingRules.ts` decide
   si se puede reservar (modo del local + mesas), el texto del botón, el aviso y la regla de
   la fianza (desde cuántas personas, cuánto por persona, horas para cancelar sin cobro y si
   el local puede cobrarla). Llega en `GET /api/public/booking/:slug` como `booking`. Lo usan
   la ficha, la reserva, la carta y la página de cancelar de la web, y la ficha y la reserva
   de la app. Quitado: 3 cálculos de fianza en el servidor, 4 funciones de fianza en web y
   app, y el cálculo del aviso en las dos. Tests: `server/reservations/__tests__/bookingRules.test.ts`.
   Queda para el punto 2: los usos en promos (mapa de promos, ficha de promo, consumo sin
   reserva). Queda para el punto 8: las tarjetas de Buscar (aún no saben si hay mesas).
2. ✅ **Promos: estado por cliente desde el servidor.** (20 nov) `GET /api/customer/promotions/availability`
   (`server/promotions/promotionAvailability.ts`) devuelve para cada promo si está
   disponible, bloqueada por cancelaciones, agotada, al límite por cliente o fuera de
   horario, con el texto ya escrito y **en hora de España** (antes la web y la app usaban
   la hora del móvil: fallaba con el móvil en otra zona). También el estado de cada premio
   del mapa de fidelidad (plazas, límite, franja para reclamar). Las promos públicas
   traen `canReserve` y `completePath` (con las reglas del punto 1).
   Quitado: `promotionAvailability` de web y app (y la ficha de promo de la app ya no lee
   todas tus reservas solo para esto). Arreglado de paso: el mapa de premios de la app
   dejaba pulsar «Reclamar» con el premio agotado, al límite o fuera de franja.
   Tests: `server/promotions/__tests__/promotionAvailability.test.ts`.
   `reservationPromotionEligibility` (cómo se pinta el estado de la promo dentro de cada
   reserva) pasa a los puntos 3 y 5, porque lo usa también el motor de misiones.
3. ✅ **Mapas de premios («En curso») desde el servidor.** (20 nov) `GET /api/customer/promotions/ladders`
   (`server/promotions/ladderProgress.ts`) devuelve todos tus mapas: escalón activo, visitas,
   qué está reclamado, listo, en curso o «a medias», con **las mismas reglas que el canje**
   (el canje ahora usa el mismo orden y la misma regla de qué visita cuenta). La app hace
   una sola llamada para todos los mapas (antes una por local). La web deja de calcularlo.
   Quitado: ~550 líneas de cálculo de mapas en la web (`promotionLadderStatus`, la mayor
   parte de `promotionReservationProgress`) y el cálculo de la app (`ladderProgress`).
   Mismo orden de escalones en servidor, web y app (desempate por id).
   Tests: `server/promotions/__tests__/ladderProgress.test.ts` (incluye que «listo para
   reclamar» coincide siempre con lo que acepta el canje).
   Probado en la app. ⚠️ La web no la he podido ver en pantalla (ver «Necesita a Fabi»).
   Las promos puntuales «con reserva» de «En curso» siguen saliendo de tus reservas (que ya
   vienen del servidor); su texto pasa al punto 6.
4. ✅ **Horas y mesas libres desde el servidor.** (20 nov) `GET /api/public/booking/:slug/availability`
   devuelve cada hora con sus mesas libres y, con `?promotionId=`, por qué la promo no deja
   esa hora (`server/reservations/slotAvailability.ts`, en hora de España; antes la web y la
   app usaban la hora del móvil).
   **Arreglado un hueco de seguridad:** al reservar con una promo de horario (2x1 de 12 a 16,
   asistencia puntual) el servidor no comprobaba la franja; solo lo hacían la web y la app.
   Ahora la reserva lo exige con las mismas reglas.
   Quitado: el cálculo de horas de la app entero (`reservationSlots`) y las reglas de franja
   de promo de web y app. La app ya enseña el aviso de «la promo de asistencia ya terminó hoy»
   y dice «con esta promo no quedan horas» en vez de «no quedan mesas».
   Tests: `server/reservations/__tests__/slotAvailability.test.ts`.
   Pendiente aparte: el panel del restaurante (alta de reserva a mano) sigue calculando sus
   horas en la web; pasa al punto 6 junto con el resto del panel.
5. ✅ **Misiones y XP calculadas en el servidor.** (20 nov) El motor de misiones vive solo en
   `server/gamification/missions/` (copiado de la web, con las fechas en hora de España
   en cualquier servidor). `POST /api/customer/gamification/evaluate` lee tus reservas,
   consumos validados, favoritos y los locales, calcula, guarda y devuelve el progreso.
   **Ya nadie puede inflar su XP**: `/sync` ignora lo que le manden y también calcula en el
   servidor (sirve a versiones viejas de la app). Los avisos de misión los manda el
   servidor solo.
   Quitado: el motor de la web y de la app (~1.050 líneas ×2), la sincronización con
   reintentos y «misiones sospechosas» de la app y `promotionReservationProgress` de la app.
   Tests movidos al servidor: `server/gamification/missions/__tests__/` (motor, De Barra y
   Mantel, hora de España, no cobrar dos veces).
   Probado en la app (Misiones: semana, mes, logros y bonus). Web publicada; verla en
   pantalla queda en «Necesita a Fabi».
6. ✅ **Código común web → app.** (20 nov) La web es la fuente. La lista está en
   `C:\adelia\scripts\shared-files.mjs` (19 archivos: juego, retos, reglas de reserva,
   avisos, modos de reserva). En la app:
   - `npm run sync:shared` los copia desde la web (con una cabecera «no lo cambies aquí»);
   - `npm run check:parity` falla si alguien los cambia a mano en la app.
   Regla: si hay que cambiar uno, se cambia en la web y se sincroniza. Lo que aún difiere
   entre web y app es sobre todo código de pantalla o de acceso a datos de cada plataforma;
   lo que es lógica de negocio ya está en el servidor (puntos 1–5).
   Las copias del catálogo del juego en el servidor (`server/gamification/missions`) se
   quitan en el punto 9.
7. ✅ **Escrituras directas a la base de datos.** (20 nov, adelantado al 6 por seguridad)
   - **Índice público de Buscar (`restaurantIndex`)**: antes lo escribía el panel del
     restaurante desde el navegador y la regla le dejaba cambiar campos como la posición
     en el mapa o el texto de búsqueda. Ahora lo escribe SOLO el servidor con un disparador
     nuevo (`onCompanyWrittenSyncRestaurantIndex`) cada vez que cambia el local, y la regla
     solo deja escribir al admin. Quitada la copia del índice de la web.
   - **Favoritos en la app**: por la API (como ya hacía la web).
   - Lo que queda escribiendo directo es el propio perfil del cliente (teléfono, datos del
     alta, promos guardadas), protegido por las reglas, y el panel del restaurante (ver 11).
   ⚠️ El disparador está publicado; se comprueba solo la próxima vez que se guarde un local
   (ver «Necesita a Fabi»).
8. ✅ **Buscar: el servidor prepara los datos.** (20 nov)
   - **Buscar por plato**: el índice de cada local incluye los platos de sus cartas
     publicadas; la búsqueda de la web y la app ya los encuentra («tostadas» → Carolina).
   - **«Reservar» en las tarjetas** solo si el local se puede reservar de verdad
     (`canReserve`, con las reglas del punto 1); si no, «Ver restaurante».
   - El índice se recalcula solo con disparadores nuevos cuando cambian las **mesas**
     (`onTableWrittenSyncRestaurantIndex`) o la **carta** (`onMenuNodeWritten…`,
     `onMenuBoardWritten…`), además del local. Relleno inicial hecho en los 17 locales
     (`scripts/resync-restaurant-index.ts`).
   - Arreglado de paso: el servidor leía los límites del plan sin cargar el catálogo en
     los disparadores (habría dicho «0 mesas»), y el carrusel de la app salía vacío al
     buscar si antes se había deslizado.
   Queda (no urgente con 17 locales): la búsqueda por texto filtra los 80 locales que
   carga la pantalla; con miles de locales hará falta buscar en el servidor (`?q=`).
9. ⏳ **Catálogos solo desde la base de datos** (niveles, ítems, misiones): quitar las
   copias fijas del código cuando el punto 5 esté hecho.
11. ⏳ **Panel del restaurante por la API.** El panel (solo web) cambia reservas, carta,
    promos y datos del local escribiendo directo en la base de datos, con las reglas como
    única protección. Pasarlo a rutas del servidor que validen cada cambio. No está
    duplicado con la app, por eso va después.
10. ⏳ **Pruebas de contrato**: tests que comprueban que cada respuesta de la API tiene
    la forma que esperan la web y la app, para que un cambio en el servidor no rompa a
    ninguna de las dos sin avisar.

## Necesita a Fabi (cuando puedas)

- 👤 En el navegador integrado de Claude hay abierta una ventana de inicio de sesión de
  Google de una prueba antigua: bloquea los scripts y la navegación de Claude. Ciérrala.
- 👤 Chrome (la extensión de Claude) no responde si la ventana no está al frente. Para
  revisar la web de los puntos 3 en adelante: con la ventana visible, o cerrando la
  ventana de Google de arriba, Claude lo comprueba en un momento. Mientras, mira tú
  Promos → «En curso» y el mapa de Carolina en la web: debe verse igual que en la app
  (premio 1 reclamado, premio 2 con 1/3).
- 👤 Cuando cambies algo en los ajustes de un local (por ejemplo, Carolina), comprueba que
  el cambio sale en Buscar al rato: así se confirma el disparador nuevo del índice.

Cada punto: se hace en servidor, web y app, se prueba en las dos (navegador y
emulador), se publica y se marca aquí con ✅.
