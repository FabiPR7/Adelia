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
4. ⏳ **Horas libres para reservar desde el servidor.** El servidor ya comprueba al
   reservar; que también devuelva las horas y mesas libres de un día.
   Quita: `reservationSlots` de web y app.
5. ⏳ **Misiones y XP calculadas en el servidor.** Hoy el móvil y el navegador calculan
   las misiones y le «proponen» la XP al servidor, que solo pone un tope. Pasar el motor
   al servidor: más seguro (nadie puede inflar su XP) y una sola copia.
   Quita: `gamificationProgress` (1.043 líneas ×2), la sincronización `/sync`.
6. ⏳ **Textos y tipos compartidos.** Una carpeta común (`shared/`) con los tipos de
   datos de la API, los textos de avisos y las funciones pequeñas (fechas en hora de
   España, precios). La web y el servidor la importan; la app la recibe con un comando
   que la copia y comprueba que no se ha tocado a mano.
7. ⏳ **La app deja de escribir directo en la base de datos.** Reservas, reseñas,
   premios y promos guardadas pasan por la API (como la web en lo nuevo). Las reglas de
   Firestore se pueden cerrar más.
8. ⏳ **Buscar desde el servidor** (filtros y búsqueda, también por plato, y que las tarjetas
   no ofrezcan «Reservar» si el local no tiene mesas).
   Quita: `publicDiscovery` y `discoveryQuickFilters` duplicados.
9. ⏳ **Catálogos solo desde la base de datos** (niveles, ítems, misiones): quitar las
   copias fijas del código cuando el punto 5 esté hecho.
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

Cada punto: se hace en servidor, web y app, se prueba en las dos (navegador y
emulador), se publica y se marca aquí con ✅.
