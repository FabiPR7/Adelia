export type PublicLegalDocId = 'aviso-legal' | 'privacidad' | 'terminos' | 'cookies'

export interface PublicLegalSection {
  heading: string
  paragraphs: string[]
}

export interface PublicLegalDocument {
  id: PublicLegalDocId
  title: string
  summary: string
  sections: PublicLegalSection[]
}

export const LEGAL_CONTACT_EMAIL = 'contacto@adeliareservas.com'
export const LEGAL_UPDATED_LABEL = '26 de septiembre de 2026'
/** Versión estable que se guarda en el perfil al aceptar legales en el registro. */
export const LEGAL_ACCEPTANCE_VERSION = '2026-09-26'
export const LEGAL_SITE_URL = 'https://adeliareservas.com'

/**
 * Identidad LSSI (Ley 34/2002): titular del sitio (persona física o sociedad).
 * Completa legalName (nombre y apellidos) y postalCode para que se publique entero.
 */
export const LEGAL_ENTITY = {
  legalName: 'Fabián Padilla Rodríguez',
  nif: '16623631J',
  addressLine: 'Ateneo Rioja 6, 3º izq.',
  postalCode: '26004',
  city: 'Logroño',
  country: 'España',
}

export function isLegalEntityPublished(): boolean {
  return Boolean(
    LEGAL_ENTITY.legalName.trim()
    && LEGAL_ENTITY.nif.trim()
    && LEGAL_ENTITY.addressLine.trim()
    && LEGAL_ENTITY.city.trim()
    && LEGAL_ENTITY.postalCode.trim(),
  )
}

export function legalEntityBlock(): string {
  if (!isLegalEntityPublished()) {
    return (
      'Los datos identificativos de la entidad titular (denominación social, NIF y domicilio) '
      + 'se publicarán en este aviso en cuanto estén formalizados. Mientras tanto, cualquier '
      + `comunicación legal, de consumidores o de protección de datos puede dirigirse a ${LEGAL_CONTACT_EMAIL}.`
    )
  }
  return [
    `Titular: ${LEGAL_ENTITY.legalName}.`,
    `NIF: ${LEGAL_ENTITY.nif}.`,
    `Domicilio: ${LEGAL_ENTITY.addressLine}, ${LEGAL_ENTITY.postalCode} ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.country}.`,
    `Contacto: ${LEGAL_CONTACT_EMAIL}.`,
  ].join(' ')
}

export const LEGAL_DOC_LINKS: { id: PublicLegalDocId; label: string }[] = [
  { id: 'aviso-legal', label: 'Aviso legal' },
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'terminos', label: 'Términos' },
  { id: 'cookies', label: 'Cookies' },
]

const CONTACT = `Puedes escribirnos a ${LEGAL_CONTACT_EMAIL}.`

export const PUBLIC_LEGAL_DOCUMENTS: Record<PublicLegalDocId, PublicLegalDocument> = {
  'aviso-legal': {
    id: 'aviso-legal',
    title: 'Aviso legal',
    summary: 'Información identificativa del prestador, exigida por la Ley 34/2002 de servicios de la sociedad de la información (LSSI-CE).',
    sections: [
      {
        heading: '1. Titular del servicio',
        paragraphs: [
          'Este sitio web y la aplicación Adelia (reservas, panel de restaurantes y app de comensales) son un servicio de la sociedad de la información prestado bajo la marca Adelia.',
          legalEntityBlock(),
          CONTACT,
        ],
      },
      {
        heading: '2. Objeto',
        paragraphs: [
          'Adelia facilita a restaurantes, bares y locales de hostelería la gestión de reservas, carta, promociones, reseñas e informes, y a los comensales el descubrimiento de locales, la reserva online, promociones, reseñas y un sistema de recompensas (Compite).',
          'El restaurante es responsable de la atención en el local, de la comida y de las condiciones particulares de su servicio. Adelia es una plataforma tecnológica intermedia.',
        ],
      },
      {
        heading: '3. Condiciones de uso',
        paragraphs: [
          'El acceso y uso de Adelia implica la aceptación de este aviso legal, de la política de privacidad, de la política de cookies y de los términos de uso.',
          'No está permitido usar el servicio de forma ilícita, suplantar identidades, atentar contra la seguridad de la plataforma ni extraer datos de forma masiva o automatizada sin autorización.',
        ],
      },
      {
        heading: '4. Propiedad intelectual',
        paragraphs: [
          'La marca Adelia, el diseño de la interfaz, los textos propios, logotipos y elementos gráficos de la plataforma pertenecen a su titular o se usan con licencia. No puedes copiarlos, revenderlos ni presentarlos como propios.',
          'Las fotos, cartas, logos y textos de cada restaurante pertenecen a ese establecimiento, que nos autoriza a mostrarlos en su ficha y en reservas.',
        ],
      },
      {
        heading: '5. Responsabilidad',
        paragraphs: [
          'Ponemos medios razonables para que el servicio esté disponible y sea seguro, pero no podemos garantizar ausencia total de interrupciones, errores técnicos o caídas de internet, Firebase u otros proveedores.',
          'No respondemos de la calidad del servicio de hostelería, de cambios de horario, de cancelaciones del restaurante ni de incidencias en sala. Tampoco de contenidos que publiquen usuarios o restaurantes (reseñas, fotos, descripciones), sin perjuicio de retirar lo que sea ilícito cuando tengamos conocimiento efectivo.',
        ],
      },
      {
        heading: '6. Legislación y fuero',
        paragraphs: [
          'Este aviso se rige por la legislación española, en particular la LSSI-CE, el RGPD, la LOPDGDD y la normativa de consumidores y usuarios cuando resulte aplicable.',
          'Si eres consumidor residente en España, puedes acudir a los juzgados de tu domicilio. La Comisión Europea ofrece una plataforma de resolución de litigios en línea: https://ec.europa.eu/consumers/odr',
        ],
      },
    ],
  },
  privacidad: {
    id: 'privacidad',
    title: 'Política de privacidad',
    summary:
      'Información completa sobre el tratamiento de datos personales de comensales y usuarios de Adelia conforme al Reglamento (UE) 2016/679 (RGPD), la Ley Orgánica 3/2018 (LOPDGDD) y la LSSI-CE.',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        paragraphs: [
          `El responsable del tratamiento de los datos tratados a través de la plataforma Adelia (sitio web y aplicación para comensales y, en lo que respecta a la cuenta de plataforma, también el panel de restaurantes) es ${LEGAL_ENTITY.legalName} (NIF ${LEGAL_ENTITY.nif}). Domicilio: ${LEGAL_ENTITY.addressLine}, ${LEGAL_ENTITY.postalCode} ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.country}. Sitio: ${LEGAL_SITE_URL}. Contacto de privacidad y ejercicio de derechos: ${LEGAL_CONTACT_EMAIL}.`,
          'Cuando realizas una reserva en un restaurante concreto, ese establecimiento actúa como responsable autónomo (o, según el caso, corresponsable) del tratamiento necesario para gestionar la reserva y la atención en el local: nombre, contacto, número de comensales, fecha y hora, mesa, comentarios, estado de la reserva y, si procede, fianza. Adelia actúa como encargado del tratamiento o como medio técnico que permite al restaurante recibir y gestionar esos datos. El restaurante debe informarte también conforme a su propia política o cartelería cuando así lo exija la normativa.',
          'Si eres restaurante y usas el panel, tratamos los datos de tu negocio para prestarte el servicio contratado (ficha, carta, mesas, reservas, clientes del local, reseñas e informes). Eres responsable frente a tus comensales de cómo usas esos datos en tu actividad de hostelería.',
        ],
      },
      {
        heading: '2. Ámbito de esta política',
        paragraphs: [
          'Esta política se aplica al uso de Adelia como comensal (registro, inicio de sesión, exploración de restaurantes, reservas online, promociones, reseñas, Compite / gamificación, amigos y retos, notificaciones in-app y preferencias) y, en lo pertinente, a visitantes que reservan sin cuenta o navegan el sitio público.',
          'No cubre sitios web o apps de terceros a los que puedas enlazar desde Adelia (por ejemplo, Google Maps para abrir direcciones), ni el tratamiento exclusivo que haga un restaurante fuera de nuestra plataforma.',
        ],
      },
      {
        heading: '3. Datos que recogemos',
        paragraphs: [
          'Cuenta de comensal: nombre para mostrar, correo electrónico, número de teléfono, contraseña (gestionada de forma cifrada por Firebase Authentication; Adelia no almacena la contraseña en claro), foto de perfil si la subes o la que aporte Google si inicias sesión con Google, proveedor de autenticación (email/contraseña o Google), estado de verificación del correo, ciudad/municipio/país/código postal de referencia, coordenadas aproximadas de tu zona («casa») si las facilitas en el onboarding, preferencias alimentarias o de cocina (gustos de exploración, no historial clínico de alergias), restaurantes favoritos, flags de onboarding y del tutorial de producto, y datos de Compite descritos más abajo.',
          'Inicio de sesión con Google: si eliges Google, recibimos de Google el identificador de cuenta, el email, el nombre y, en su caso, la foto de perfil, en la medida en que Google nos los facilite y tú lo autorices en el flujo de OAuth.',
          'Reserva (con o sin cuenta): nombre, email y/o teléfono, número de comensales (pax), fecha y franja horaria, mesa o preferencias de mesa, comentarios o notas, estado de la reserva (pendiente, confirmada, cancelada, etc.), identificador de usuario si estás logueado, y datos de promoción asociada si reservas con una promo (por ejemplo, gasto mínimo o visitas).',
          'Fianzas y pagos: importe, estado del depósito e identificadores de la operación en Stripe (por ejemplo, PaymentIntent). El número completo de la tarjeta y los datos sensibles de pago los trata Stripe; Adelia no los almacena.',
          'Reseñas: puntuación, texto, fotos o vídeos que subas, productos o promociones etiquetados, nombre mostrado y Adelinas u otras recompensas asociadas a la reseña.',
          'Promociones y consumo: reclamaciones de promociones, consumos verificados en el local (cuando el restaurante o el flujo de la app lo registran) e información necesaria para aplicar cartas o tokens de Compite a una promo.',
          'Compite (gamificación): experiencia (XP), nivel, Adelinas, misiones completadas (semanales, mensuales e históricas), inventario de cartas/ítems virtuales, claves de recompensas ya otorgadas, créditos de visita por restaurante, penalizaciones o avisos por cancelaciones, y estado de celebraciones o tutoriales de recompensa. Son recompensas virtuales sin valor de dinero de curso legal.',
          'Social (amigos y retos): solicitudes y amistades (nombre y foto visibles a tus amigos), invitaciones a reservas y retos asociados a una reserva, en la medida en que uses esas funciones.',
          'Notificaciones in-app: avisos sobre reservas, promos u otros eventos del servicio, guardados en tu cuenta. Los emails transaccionales (confirmación, cancelación, verificación de email, restablecimiento de contraseña, recordatorios) se envían a la dirección que nos facilitas.',
          'CRM del restaurante: al reservar, el local puede conservar en su historial de clientes de Adelia tu nombre, email, teléfono y contadores de visitas asociados a esa relación comercial con el establecimiento.',
          'Datos técnicos y de seguridad: dirección IP, identificadores de sesión, tipo de dispositivo o navegador en la medida técnica habitual, intentos de acceso fallidos, eventos de seguridad, límites de uso (rate limiting) y, cuando está activo, resultados de reCAPTCHA para proteger el registro u otros formularios frente a abusos.',
          'Analítica (solo si aceptas cookies analíticas): Firebase Analytics y eventos first-party de uso (por ejemplo, ver ficha de restaurante, abrir carta, entrar en promociones, reclamar una promo, añadir favorito o iniciar reserva), asociados a tu cuenta o a un identificador aleatorio del navegador (`adelia_anon_id`). Los eventos individuales se conservan del orden de ~120 días; los restaurantes ven informes agregados, no tu identidad personal detrás de cada clic.',
          'Ubicación: (a) si activas «cerca de mí», el navegador puede facilitar coordenadas temporales en tu dispositivo para ordenar locales cercanos; (b) en el onboarding puedes guardar una zona o coordenadas de referencia en tu perfil. No usamos tu ubicación para publicidad de terceros ni para vender perfiles.',
          'Almacenamiento local del navegador (además de cookies): preferencias de cookies, favoritos previos al login, estados de UI de promociones, marcas del tutorial de producto, recibos de celebraciones de Compite y datos de sesión de Firebase Authentication. Detalle en la Política de cookies.',
          'No tratamos de forma deliberada categorías especiales del art. 9 RGPD (salud, ideología, etc.). Las preferencias de cocina son gustos de descubrimiento. No introduces en reseñas ni notas de reserva datos sensibles de terceros ni información de salud que no sea estrictamente necesaria.',
        ],
      },
      {
        heading: '4. Origen de los datos',
        paragraphs: [
          'Los facilitas tú en formularios (registro, onboarding, reserva, reseña, perfil).',
          'Los aportan proveedores de identidad (Google) si eliges ese inicio de sesión.',
          'Los generan el uso del servicio (estado de reservas, progreso en Compite, eventos técnicos).',
          'Los generan el restaurante al gestionar tu reserva o verificar un consumo o asistencia cuando aplica.',
          'Los aportan proveedores de pago (Stripe) respecto al resultado de la fianza, sin darnos el PAN completo.',
        ],
      },
      {
        heading: '5. Finalidades y bases jurídicas',
        paragraphs: [
          'Crear y mantener tu cuenta, autenticarte, verificar el email, recuperar la contraseña y completar el onboarding: ejecución del contrato / medidas precontractuales (art. 6.1.b RGPD).',
          'Gestionar reservas, cancelaciones, listas de espera o cambios, y mostrar tu historial: art. 6.1.b; respecto al restaurante, su relación contigo como cliente del local.',
          'Mostrar y reclamar promociones, Compite (misiones, niveles, inventario), amigos, retos e invitaciones: art. 6.1.b.',
          'Publicar y moderar reseñas asociadas a visitas: art. 6.1.b e interés legítimo en la integridad del servicio (art. 6.1.f), ponderado con tus derechos.',
          'Procesar fianzas o depósitos a través de Stripe Connect hacia la cuenta del restaurante: art. 6.1.b y, en lo aplicable, obligaciones legales y prevención del fraude (arts. 6.1.c y 6.1.f).',
          'Enviar emails y notificaciones in-app estrictamente relacionados con el servicio (confirmaciones, cancelaciones, verificación, reset de contraseña, recordatorios de reserva): art. 6.1.b. No enviamos newsletter ni publicidad comercial de Adelia a comensales sin una base jurídica adecuada (consentimiento u otra válida). Las ofertas las publica el restaurante en la app.',
          'Seguridad, prevención de abusos, bloqueo de cuentas fraudulentas, rate limiting y registros de acceso: interés legítimo (art. 6.1.f).',
          'Cookies no esenciales, Firebase Analytics y eventos first-party de producto: tu consentimiento (art. 6.1.a), que puedes retirar en cualquier momento desde el banner o la Política de cookies.',
          'Cumplir obligaciones legales, atender reclamaciones de consumidores o requerimientos de autoridad competente: art. 6.1.c.',
          'Elaborar estadísticas agregadas de uso de la plataforma y, con tu consentimiento analítico, informes agregados para cada restaurante: art. 6.1.a (analítica) y, para agregados estrictamente necesarios al servicio, art. 6.1.f cuando no dependan de cookies no esenciales.',
          'Sobre decisiones automatizadas e IA: ver la sección 11.',
        ],
      },
      {
        heading: '6. Destinatarios y encargados del tratamiento',
        paragraphs: [
          'Restaurante reservado: recibe los datos necesarios para atender la reserva y, en su caso, el historial de cliente del local en Adelia.',
          'Google Ireland Limited / Google LLC (Firebase): Authentication, Cloud Firestore, Hosting, Cloud Functions y, si consientes, Google Analytics for Firebase. Tratan datos como encargados / subencargados para alojar, autenticar y operar la plataforma. Puede haber transferencias fuera del EEE amparadas por cláusulas contractuales tipo de la Comisión Europea y las medidas adicionales publicadas por Google.',
          'Stripe (Stripe Payments Europe / entidades del grupo Stripe): procesamiento de fianzas y pagos de comensales hacia la cuenta Connect del restaurante. Adelia no almacena el número completo de tarjeta. Stripe actúa conforme a su propia política y a su condición de proveedor de servicios de pago.',
          'Lemon Squeezy (Lemon Squeezy, LLC / entidades del grupo): procesamiento de la suscripción SaaS del restaurante (planes Sala/Local y ciclos de facturación). El pago del plan no pasa por Stripe; Lemon Squeezy trata email de facturación, identificadores de suscripción/cliente y estado del cobro. Adelia recibe webhooks firmados para sincronizar el plan activo. Lemon Squeezy actúa como merchant of record / proveedor de pago según su política.',
          'Resend (u otro proveedor equivalente de correo transaccional): envío de emails del servicio (desde dominios como adeliareservas.com).',
          'Cloudinary: alojamiento y entrega (CDN) de imágenes y vídeos que subes (foto de perfil, media de reseñas). Guardamos la URL del recurso; el archivo lo aloja Cloudinary.',
          'MapTiler y/o OpenStreetMap (teselas de mapa) y servicios de geocodificación / autocompletado de ciudades (por ejemplo Photon/Komoot u equivalentes en servidor): para mostrar mapas y ayudarte a indicar zona o dirección. El uso concreto depende de la configuración del entorno.',
          'Google (reCAPTCHA): cuando está activado, para distinguir humanos de bots en registro u otros formularios. Puede implicar tratamiento por Google según su política de reCAPTCHA.',
          'Google Fonts: carga de tipografías desde servidores de Google al visitar el sitio (el navegador puede comunicar la IP a Google).',
          'Proveedores de infraestructura y seguridad estrictamente necesarios para operar (por ejemplo, logs de red o límites de abuso), siempre bajo contrato o medidas equivalentes cuando traten datos personales.',
          'Autoridades públicas cuando exista obligación legal o requerimiento válido.',
          'No vendemos tus datos personales a terceros para su publicidad. No cedemos tu email a redes publicitarias de terceros.',
        ],
      },
      {
        heading: '7. Transferencias internacionales',
        paragraphs: [
          `Varios encargados (Google/Firebase, Stripe, Lemon Squeezy, Cloudinary, Resend, etc.) pueden tratar datos en o desde países fuera del Espacio Económico Europeo. Cuando ello ocurre, se basan en una decisión de adecuación de la Comisión Europea, en cláusulas contractuales tipo u otras garantías del capítulo V del RGPD. Puedes solicitar más información escribiendo a ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: '8. Plazos de conservación',
        paragraphs: [
          'Cuenta de comensal: mientras la cuenta esté activa. Si solicitas la baja, eliminaremos o anonimizaremos los datos de cuenta que no debamos conservar por ley u obligación frente a terceros (por ejemplo, trazas mínimas de una reserva ya facturada o reclamada).',
          'Reservas y datos asociados en el CRM del restaurante: el tiempo necesario para la gestión del local, Compite, atención de incidencias y obligaciones legales o de defensa de reclamaciones (plazos típicos de prescripción en consumo y civil en España, evaluados caso a caso).',
          'Reseñas: mientras permanezcan publicadas o hasta que las elimines tú (si la función lo permite) o las retiremos por incumplimiento; pueden conservarse copias limitadas si hay litigio o requerimiento.',
          'Datos de Compite e inventario: mientras la cuenta exista o hasta la baja / anonimización.',
          'Eventos de analítica first-party: del orden de 120 días a nivel de evento individual; agregados pueden conservarse más tiempo sin identificación directa.',
          'Tokens de restablecimiento de contraseña: plazo corto (horas).',
          'Registros de seguridad e intentos de acceso: el mínimo útil para investigar abusos (normalmente meses, salvo incidente que exija más).',
          'Emails: el proveedor de correo puede conservar logs técnicos el tiempo de su política; el contenido se envía para la finalidad transaccional.',
        ],
      },
      {
        heading: '9. Cómo ejercer tus derechos',
        paragraphs: [
          'Puedes ejercer los derechos de acceso, rectificación, supresión («derecho al olvido»), oposición, limitación del tratamiento, portabilidad y a no ser objeto de decisiones automatizadas con efectos jurídicos, en los términos del RGPD.',
          'Puedes retirar en cualquier momento el consentimiento de cookies analíticas sin que ello afecte a la licitud del tratamiento previo.',
          `Para ejercer derechos frente a Adelia como responsable de la plataforma, escribe a ${LEGAL_CONTACT_EMAIL} indicando el derecho que solicitas, un email de contacto y, si es preciso, datos que permitan verificar tu identidad. Responderemos en el plazo legal.`,
          'Como comensal, también puedes eliminar tu cuenta desde Perfil → «Eliminar cuenta» en la app. Eso borra o anonimiza los datos de cuenta, Compite, social y reseñas asociadas a tu identidad; las reservas históricas del restaurante se anonimizan (se mantienen el hueco y datos operativos sin tu nombre/email/teléfono).',
          'La portabilidad (copia de tus datos de cuenta en formato estructurado) se atiende bajo solicitud al email de contacto.',
          'Si el tratamiento lo realiza el restaurante como responsable de una reserva concreta, puedes dirigirte también a ese establecimiento; te ayudaremos a redirigir la petición cuando sea razonable.',
          'Tienes derecho a presentar reclamación ante la Agencia Española de Protección de Datos (www.aepd.es). Si eres consumidor, también puedes usar la plataforma europea de resolución de litigios en línea: https://ec.europa.eu/consumers/odr',
        ],
      },
      {
        heading: '10. Seguridad',
        paragraphs: [
          'Aplicamos medidas técnicas y organizativas razonables: autenticación gestionada por Firebase, comunicación HTTPS, reglas de acceso a base de datos, separación de roles (comensal / restaurante / administración), limitación de intentos de acceso y revisión de incidencias.',
          `Ningún sistema es 100 % seguro. Si detectas un acceso no autorizado a tu cuenta, cambia la contraseña y avísanos en ${LEGAL_CONTACT_EMAIL}.`,
          'Si se produce una violación de seguridad que afecte a tus datos personales con alto riesgo, te informaremos sin dilación indebida conforme al art. 34 RGPD, además de notificar a la autoridad de control cuando proceda (art. 33).',
        ],
      },
      {
        heading: '11. Decisiones automatizadas e inteligencia artificial',
        paragraphs: [
          'No tomamos decisiones automatizadas con efectos jurídicos o significativamente análogos sobre ti (art. 22 RGPD). Compite aplica reglas de juego predefinidas (XP, misiones, inventario); las fianzas siguen reglas del restaurante y de Stripe.',
          'Adelia no utiliza modelos de inteligencia artificial generativa para elaborar perfiles, decidir reservas, moderar reseñas de forma automática con consecuencias jurídicas ni tratar tu contenido personal con fines de entrenamiento de modelos de terceros.',
          'Pueden existir asistentes internos de desarrollo o soporte ajenos al tratamiento de tus datos de producción; no forman parte del servicio que tratamos sobre tu cuenta.',
        ],
      },
      {
        heading: '12. Menores de edad',
        paragraphs: [
          'Adelia no está dirigida a menores de 14 años. No recopilamos de forma consciente datos de menores de esa edad. Si detectamos una cuenta de un menor de 14 años, la cancelaremos y borraremos o anonimizaremos los datos asociados, sin perjuicio de obligaciones legales.',
          'En España, el art. 7 LOPDGDD admite el consentimiento del menor para tratamientos de la sociedad de la información a partir de 14 años. Si tienes entre 14 y 17 años, debes usar el servicio solo si puedes entender estas condiciones; si no, pide a un adulto que te acompañe.',
          'No verificamos la edad con documento en el registro; confíamos en la veracidad de los datos y en las denuncias o indicios que recibamos.',
        ],
      },
      {
        heading: '13. Redes sociales y enlaces',
        paragraphs: [
          'Si compartes contenido de Adelia en redes sociales o abres enlaces externos (mapas, sitios del restaurante, etc.), esos terceros tratan datos bajo sus propias políticas. Revisa sus avisos antes de usarlos.',
        ],
      },
      {
        heading: '14. Restaurantes (información adicional)',
        paragraphs: [
          'Si usas el panel de restaurante, eres responsable de informar a tus comensales sobre tu tratamiento (en local, web o carta) y de usar Adelia solo para gestionar tu actividad de hostelería y reservas.',
          'No debes cargar bases de datos obtenidas sin base legal ni usar el historial de clientes para finalidades incompatibles (spam masivo, cesión ilícita, etc.).',
          'Las obligaciones del encargado entre Adelia y el restaurante se completan, cuando proceda, con el contrato de encargo o las cláusulas del servicio de plataforma.',
          'La baja de la cuenta de restaurante (panel) se gestiona desde el plan / facturación del local, con confirmación del nombre del establecimiento.',
        ],
      },
      {
        heading: '15. Cambios en esta política',
        paragraphs: [
          'Podemos actualizar esta política para reflejar cambios legales, técnicos o del servicio. La fecha de «Última actualización» al inicio del documento indica la versión vigente. Si el cambio es sustancial, lo comunicaremos de forma razonable en el servicio o por email cuando proceda.',
          'El uso continuado de Adelia tras la publicación de la nueva versión implica el conocimiento de la misma. Si no estás de acuerdo, puedes dejar de usar el servicio y solicitar la baja de tu cuenta.',
        ],
      },
    ],
  },
  terminos: {
    id: 'terminos',
    title: 'Términos de uso',
    summary: 'Condiciones del servicio para comensales y para restaurantes que usan Adelia.',
    sections: [
      {
        heading: '1. Aceptación',
        paragraphs: [
          'Al crear una cuenta, reservar o usar el panel de restaurante aceptas estos términos, el aviso legal, la privacidad y las cookies.',
          'Adelia puede actualizar estos textos. La fecha de la última versión aparece en cada documento. Si el cambio es relevante, lo indicaremos en el servicio cuando sea razonable.',
        ],
      },
      {
        heading: '2. Cuentas',
        paragraphs: [
          'Debes facilitar datos veraces y custodiar tu contraseña. Hay cuentas de comensal, de restaurante y de administración interna.',
          'El acceso de restaurante es nominativo para el local. No compartas la contraseña con personal que no deba gestionar reservas.',
          'Podemos suspender cuentas por fraude, impagos de fianzas reiterados, abusos, reseñas falsas o uso que ponga en riesgo a otros usuarios o al servicio.',
        ],
      },
      {
        heading: '3. Reservas',
        paragraphs: [
          'Al reservar te comprometes a acudir o a cancelar con la antelación que indique el restaurante. La disponibilidad puede cambiar por causas del local o técnicas.',
          'El restaurante confirma, modifica o cancela según su operación. Adelia transmite esas decisiones, pero no presta el servicio de hostelería.',
          'Si hay fianza, Stripe autoriza o captura el importe según las reglas que configure el restaurante (por ejemplo, no-show). Revisa esas condiciones antes de pagar.',
        ],
      },
      {
        heading: '4. Promociones, reseñas y Compite',
        paragraphs: [
          'Las promociones las define el restaurante (cupos, horarios, requisitos de asistencia). Pueden agotarse o retirarse.',
          'Las reseñas deben ser honestas y referirse a una visita real. No publiques contenido ilegal, ofensivo o que identifique a terceros sin necesidad.',
          'XP, niveles, insignias, Adelinas e inventario de Compite son recompensas virtuales de la plataforma, sin valor de dinero de curso legal y no canjeables por efectivo. Podemos equilibrar la economía del juego si hay abusos o errores.',
          'Algunas cartas de Compite (por ejemplo, salvoconducto de fianza o escudos de cancelación) pueden alterar temporalmente las reglas de fianza o penalización en el flujo de reserva; su uso queda registrado y sujeto a las reglas del restaurante y de Stripe.',
        ],
      },
      {
        heading: '5. Restaurantes',
        paragraphs: [
          'Eres responsable de la exactitud de tu ficha, horarios, mesas, carta, precios y promociones, y del cumplimiento de normativa sanitaria, de consumo y fiscal de tu actividad.',
          'Debes tratar los datos de tus comensales conforme al RGPD. Adelia te facilita herramientas; no sustituye tu obligación como responsable de la reserva en el local.',
          'El plan actual no cobra comisión por reserva. Cualquier cambio de precio se comunicará con antelación razonable.',
        ],
      },
      {
        heading: '6. Limitación',
        paragraphs: [
          'En la medida permitida por la ley, Adelia no responde de lucro cesante, pérdida de reservas por cortes de red o de daños causados por el restaurante o por el comensal.',
          'Nada en estos términos limita derechos irrenunciables de consumidores y usuarios.',
        ],
      },
    ],
  },
  cookies: {
    id: 'cookies',
    title: 'Política de cookies',
    summary: 'Información exigida por el artículo 22.2 de la LSSI-CE y por las directrices de la AEPD sobre cookies y tecnologías similares.',
    sections: [
      {
        heading: '1. Qué son',
        paragraphs: [
          'Las cookies son pequeños archivos que el sitio guarda en tu navegador. También usamos tecnologías similares: almacenamiento local (localStorage / sessionStorage), identificadores del SDK de Firebase Authentication y, si lo aceptas, Firebase Analytics.',
          'Esta política complementa la Política de privacidad. El responsable es el mismo (Adelia / Adelia Reservas); contacto: ' + LEGAL_CONTACT_EMAIL + '.',
        ],
      },
      {
        heading: '2. Cookies y storages necesarios',
        paragraphs: [
          'Son imprescindibles para iniciar sesión, mantener tu sesión de Firebase Authentication, recordar si ya respondiste al banner de cookies (`adelia.cookieConsent.v1`), proteger el servicio frente a abusos y guardar preferencias técnicas mínimas del producto (por ejemplo, favoritos previos al login o el estado del tutorial de la app).',
          'No requieren consentimiento según la AEPD cuando permiten la transmisión de una comunicación o un servicio expresamente solicitado. Si las bloqueas por completo en el navegador, es posible que no puedas entrar ni reservar con cuenta.',
        ],
      },
      {
        heading: '3. Cookies y tecnologías analíticas (opcionales)',
        paragraphs: [
          'Solo con tu consentimiento activamos Firebase Analytics (Google) y el envío de eventos first-party de producto (visitas a fichas, carta, promociones, reclamaciones, favoritos, inicio de reserva, etc.), asociados a tu cuenta o a un identificador aleatorio del navegador (`adelia_anon_id`).',
          'Sirven para mejorar Adelia y elaborar estadísticas agregadas (también para informes agregados que ve cada restaurante). No las usamos para vender publicidad de terceros ni para crear perfiles publicitarios fuera de Adelia.',
          'Puedes rechazarlas o cambiar de opinión más tarde en este documento (botón de preferencias), en el aviso de cookies, o borrando el almacenamiento del sitio en tu navegador.',
        ],
      },
      {
        heading: '4. Terceros relacionados con la carga de la página',
        paragraphs: [
          'Al usar Adelia, tu navegador puede conectar con servicios que intervienen en la prestación técnica: Google (Firebase, Analytics si consientes, Fonts, reCAPTCHA si está activo), Cloudinary (imágenes), MapTiler u OpenStreetMap (mapas) y el propio hosting de Adelia. Algunos de estos actores pueden registrar la IP u otros datos técnicos bajo sus políticas.',
          'Los pagos con fianza se realizan en el entorno de Stripe; pueden establecerse cookies propias de Stripe en el flujo de pago, ajenas a nuestro banner cuando son necesarias para completar la operación que has pedido.',
          'La suscripción del restaurante (planes) se gestiona en Lemon Squeezy; el checkout y el portal del cliente de Lemon pueden fijar cookies propias de ese dominio al pagar o gestionar el plan.',
        ],
      },
      {
        heading: '5. Cómo gestionarlas',
        paragraphs: [
          'En el banner puedes aceptar todas, rechazar las opcionales o configurar solo la analítica. Tu elección se guarda en este navegador.',
          'También puedes borrar cookies y datos del sitio desde Chrome, Safari, Firefox o Edge. El rechazo de analítica no impide usar Adelia.',
          'Más detalle sobre tratamientos personales: Política de privacidad.',
        ],
      },
    ],
  },
}

export function isPublicLegalDocId(value: string | undefined): value is PublicLegalDocId {
  return value === 'aviso-legal'
    || value === 'privacidad'
    || value === 'terminos'
    || value === 'cookies'
}

export function legalDocPath(id: PublicLegalDocId, from?: string): string {
  const base = `/legal/${id}`
  if (!from) {
    return base
  }
  return `${base}?from=${encodeURIComponent(from)}`
}

export function safeLegalReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }
  if (/[\t\n\r]/.test(value) || value.includes('://')) {
    return null
  }
  try {
    const parsed = new URL(value, 'https://adeliareservas.com')
    if (parsed.origin !== 'https://adeliareservas.com' || parsed.username || parsed.password) {
      return null
    }
  } catch {
    return null
  }
  return value
}
