export type PublicLegalDocId = 'aviso-legal' | 'privacidad' | 'terminos' | 'cookies' | 'encargo'

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
export const LEGAL_UPDATED_LABEL = '7 de noviembre de 2026'
/** Versión estable que se guarda en el perfil al aceptar legales en el registro. */
export const LEGAL_ACCEPTANCE_VERSION = '2026-11-07'
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
  { id: 'encargo', label: 'Encargo de datos' },
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
          'Adelia no requiere autorización administrativa previa para esta actividad ni está adherida a códigos de conducta. Los precios de los planes se publican en la página de planes y los de cada restaurante en su ficha.',
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
          'El uso de Adelia se rige por este aviso legal y por los términos de uso. Cómo tratamos tus datos se explica en la política de privacidad y en la de cookies.',
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
          `Si eres consumidor residente en España, puedes reclamar en ${LEGAL_CONTACT_EMAIL} o ante los servicios de consumo de tu comunidad autónoma, y acudir a los juzgados de tu domicilio. Adelia no está adherida a ningún sistema de resolución alternativa de litigios ni obligada a ello.`,
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
          'Reserva (con o sin cuenta): nombre, email y/o teléfono, número de comensales (pax), fecha y franja horaria, mesa o preferencias de mesa, comentarios o notas, estado de la reserva (pendiente, confirmada, cancelada, etc.), identificador de usuario si estás logueado, y datos de promoción asociada si reservas con una promo (por ejemplo, gasto mínimo o visitas). Si tienes una cuenta con el mismo correo verificado, en «Mis reservas» verás también las reservas hechas con ese correo sin haber entrado.',
          'Fianzas y pagos: importe, estado del depósito e identificadores de la operación en Stripe (por ejemplo, PaymentIntent). El número completo de la tarjeta y los datos sensibles de pago los trata Stripe; Adelia no los almacena.',
          'Reseñas: puntuación, texto, fotos o vídeos que subas, productos o promociones etiquetados, nombre mostrado y Adelinas u otras recompensas asociadas a la reseña. **Las reseñas son públicas**: cualquiera puede ver el nombre que muestras, la fecha, el texto y las fotos en la ficha del local.',
          'Promociones y consumo: reclamaciones de promociones, consumos verificados en el local (cuando el restaurante o el flujo de la app lo registran) e información necesaria para aplicar cartas o tokens de Compite a una promo.',
          'Compite (gamificación): experiencia (XP), nivel, Adelinas, misiones completadas (semanales, mensuales e históricas), inventario de cartas/ítems virtuales, claves de recompensas ya otorgadas, créditos de visita por restaurante, penalizaciones o avisos por cancelaciones, y estado de celebraciones o tutoriales de recompensa. Son recompensas virtuales sin valor de dinero de curso legal.',
          'Social (amigos y retos): solicitudes y amistades (nombre y foto visibles a tus amigos), invitaciones a reservas y retos asociados a una reserva, en la medida en que uses esas funciones. Otros clientes pueden encontrarte por tu nombre para enviarte una solicitud.',
          '**Ranking de Compite**: tu nombre, foto, ciudad y XP son visibles para otros clientes con cuenta. Si no quieres aparecer, puedes usar un nombre distinto al real y no subir foto, o darte de baja.',
          'Notificaciones in-app: avisos sobre reservas, promos u otros eventos del servicio, guardados en tu cuenta. Los emails transaccionales (confirmación, cancelación, verificación de email, restablecimiento de contraseña, recordatorios) se envían a la dirección que nos facilitas.',
          'CRM del restaurante: al reservar, el local puede conservar en su historial de clientes de Adelia tu nombre, email, teléfono y contadores de visitas asociados a esa relación comercial con el establecimiento.',
          'Datos técnicos y de seguridad: dirección IP, identificadores de sesión, tipo de dispositivo o navegador en la medida técnica habitual, intentos de acceso fallidos, eventos de seguridad, límites de uso (rate limiting) y, cuando está activo, resultados de reCAPTCHA para proteger el registro u otros formularios frente a abusos.',
          'Analítica (solo si aceptas cookies analíticas): Firebase Analytics y eventos first-party de uso (por ejemplo, ver ficha de restaurante, abrir carta, entrar en promociones, reclamar una promo, añadir favorito o iniciar reserva), asociados a tu cuenta o a un identificador aleatorio del navegador (`adelia_anon_id`). Los eventos individuales se conservan del orden de ~120 días; los restaurantes ven informes agregados, no tu identidad personal detrás de cada clic.',
          'Ubicación: (a) si activas «cerca de mí», el navegador puede facilitar coordenadas temporales en tu dispositivo para ordenar locales cercanos; (b) en el onboarding puedes guardar una zona o coordenadas de referencia en tu perfil. No usamos tu ubicación para publicidad de terceros ni para vender perfiles.',
          'Almacenamiento local del navegador (además de cookies): preferencias de cookies, favoritos previos al login, estados de UI de promociones, marcas del tutorial de producto, recibos de celebraciones de Compite y datos de sesión de Firebase Authentication. Detalle en la Política de cookies.',
          'No pedimos categorías especiales del art. 9 RGPD (salud, ideología, etc.), y las preferencias de cocina son gustos de descubrimiento. **No escribas alergias ni otros datos de salud** en reseñas o notas de reserva: comunícalas directamente al restaurante.',
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
          `Enviar emails y notificaciones in-app relacionados con el servicio (confirmaciones, cancelaciones, verificación, reset de contraseña, recordatorios de reserva): art. 6.1.b. Adelia no envía newsletter ni publicidad propia a comensales. Algunos correos de reserva pueden incluir un bloque señalado como publicidad del propio restaurante, por tu relación previa con él (art. 21.2 LSSI); puedes oponerte gratis en ${LEGAL_CONTACT_EMAIL}.`,
          'Mostrar tu nombre, foto, ciudad y XP en el ranking y permitir que te encuentren tus amigos: art. 6.1.b, porque forma parte de Compite. Publicar tus reseñas: art. 6.1.b.',
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
          'Google Ireland Limited / Google LLC (Firebase): Authentication, Cloud Firestore, Hosting, Cloud Functions y, si consientes, Google Analytics for Firebase. Tratan datos como encargados / subencargados para alojar, autenticar y operar la plataforma. La base de datos está en la región de Madrid (europe-southwest1). Puede haber transferencias fuera del EEE amparadas por cláusulas contractuales tipo de la Comisión Europea y las medidas adicionales publicadas por Google.',
          'Stripe (Stripe Payments Europe / entidades del grupo Stripe): procesamiento de fianzas y pagos de comensales hacia la cuenta Connect del restaurante. Adelia no almacena el número completo de tarjeta. Stripe actúa conforme a su propia política y a su condición de proveedor de servicios de pago.',
          'Lemon Squeezy (Lemon Squeezy, LLC / entidades del grupo): procesamiento de la suscripción SaaS del restaurante (planes Sala/Local y ciclos de facturación). El pago del plan no pasa por Stripe; Lemon Squeezy trata email de facturación, identificadores de suscripción/cliente y estado del cobro. Adelia recibe webhooks firmados para sincronizar el plan activo. Lemon Squeezy actúa como merchant of record / proveedor de pago según su política.',
          'Resend (u otro proveedor equivalente de correo transaccional): envío de emails del servicio (desde dominios como adeliareservas.com).',
          'Cloudinary: alojamiento y entrega (CDN) de imágenes y vídeos que subes (foto de perfil, media de reseñas). Guardamos la URL del recurso; el archivo lo aloja Cloudinary.',
          'MapTiler y/o OpenStreetMap (teselas de mapa) y servicios de geocodificación / autocompletado de ciudades (por ejemplo Photon/Komoot u equivalentes en servidor): para mostrar mapas y ayudarte a indicar zona o dirección. El uso concreto depende de la configuración del entorno.',
          'Google (reCAPTCHA): cuando está activado, para distinguir humanos de bots en registro u otros formularios. Puede implicar tratamiento por Google según su política de reCAPTCHA.',
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
          'Cuenta de comensal: mientras la cuenta esté activa. Si te das de baja, eliminamos o anonimizamos los datos de cuenta, salvo lo que debamos conservar bloqueado por ley para atender reclamaciones (con carácter general, hasta 5 años para acciones civiles y 6 años para documentación fiscal o mercantil).',
          'Reservas y datos asociados en el CRM del restaurante: mientras el restaurante mantenga su cuenta y los necesite para gestionar su relación contigo, salvo que pidas su supresión o te des de baja. El restaurante decide sobre estos datos como responsable, y se suprimen cuando elimina su cuenta.',
          'Reseñas: mientras permanezcan publicadas o hasta que las elimines tú (si la función lo permite) o las retiremos por incumplimiento; pueden conservarse copias limitadas si hay litigio o requerimiento.',
          'Datos de Compite e inventario: mientras la cuenta exista o hasta la baja / anonimización.',
          'Eventos de analítica first-party: 120 días a nivel de evento individual; agregados pueden conservarse más tiempo sin identificación directa.',
          'Tokens de restablecimiento de contraseña: 1 hora.',
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
          'Como comensal, también puedes eliminar tu cuenta desde Perfil → «Eliminar cuenta» en la app. Eso borra o anonimiza los datos de cuenta, Compite, social y reseñas asociadas a tu identidad, y tu ficha de cliente en los restaurantes con los que quede relación. Las reservas y consumos históricos se anonimizan: el local conserva el hueco y los importes, sin tu nombre, email ni teléfono. Si tu correo está verificado, también se anonimizan las reservas hechas solo con ese correo.',
          'La portabilidad (copia de tus datos de cuenta en formato estructurado) se atiende bajo solicitud al email de contacto.',
          'Si el tratamiento lo realiza el restaurante como responsable de una reserva concreta, puedes dirigirte también a ese establecimiento; te ayudaremos a redirigir la petición cuando sea razonable.',
          'Tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos ([www.aepd.es](https://www.aepd.es)).',
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
          'La relación entre Adelia y el restaurante sobre estos datos se rige por el contrato de encargo de tratamiento, publicado junto a estos documentos, que el restaurante acepta en el alta.',
          'La baja de la cuenta de restaurante se hace desde la zona de Plan del panel, confirmando el nombre del establecimiento. Elimina sus reservas, clientes, reseñas, promociones y cartas, y cancela antes la suscripción de pago.',
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
    summary: 'Condiciones del servicio para comensales y para restaurantes que usan Adelia, incluidas las normas sobre contenidos, reseñas, orden de resultados y contratación de planes.',
    sections: [
      {
        heading: '1. Aceptación y contratación',
        paragraphs: [
          'Estos términos regulan el uso de Adelia. Los aceptas al crear una cuenta, reservar o usar el panel de restaurante. La política de privacidad y la de cookies son información sobre el tratamiento de tus datos, no condiciones que debas aceptar.',
          'El contrato se celebra en español. Para registrarte rellenas el formulario, revisas los datos y aceptas estos términos; los errores se corrigen antes de enviar. Conservamos la fecha y la versión aceptada, y siempre puedes consultar la versión vigente en esta página.',
          `Punto de contacto para usuarios y autoridades, también a efectos del Reglamento (UE) 2022/2065 de Servicios Digitales: ${LEGAL_CONTACT_EMAIL}. Idioma: español.`,
        ],
      },
      {
        heading: '2. Cuentas',
        paragraphs: [
          'Debes tener al menos 14 años para crear una cuenta de comensal, y ser mayor de edad para pagar una fianza. La cuenta de restaurante debe abrirla un mayor de edad con capacidad para representar al negocio.',
          'Debes facilitar datos veraces y custodiar tu contraseña. El acceso de restaurante es para el local: no lo compartas con quien no deba gestionar reservas.',
          'Puedes darte de baja cuando quieras desde tu perfil o desde la zona de Plan.',
        ],
      },
      {
        heading: '3. Reservas y fianzas',
        paragraphs: [
          'Adelia es una plataforma intermediaria: el servicio de hostelería lo presta el restaurante, que es quien confirma, modifica o cancela las reservas y responde de la atención, la comida y la información de su carta, incluidos los alérgenos.',
          'Al reservar te comprometes a acudir o a cancelar con la antelación que indique el restaurante. La disponibilidad puede cambiar por causas del local o técnicas.',
          'Si la reserva requiere fianza, antes de confirmar verás el importe y el plazo de cancelación. Stripe retiene o cobra el importe según esas condiciones, y el dinero corresponde al restaurante. Las reclamaciones sobre una fianza puedes dirigirlas al local o a nuestro contacto, y te ayudaremos a tramitarlas.',
          'Las reservas de restauración para una fecha concreta no tienen derecho de desistimiento de 14 días (art. 103.l del Real Decreto Legislativo 1/2007). Se aplican las condiciones de cancelación que se muestran al reservar.',
        ],
      },
      {
        heading: '4. Reseñas',
        paragraphs: [
          'Solo puede publicar una reseña quien tiene una cuenta con una reserva confirmada en ese local; comprobamos esa relación antes de publicarla. Las reseñas muestran el nombre de quien las escribe y la fecha.',
          'Las reseñas se publican sin pago y con independencia de la puntuación. El restaurante puede responder, pero no puede borrarlas ni cambiarlas. Las recompensas que recibe quien opina no dependen de que la opinión sea positiva.',
          'Debes contar tu experiencia real. Están prohibidas las reseñas falsas, compradas o escritas por el propio local o por encargo suyo, y puede suspenderse la cuenta de quien las publique.',
        ],
      },
      {
        heading: '5. Orden de los resultados',
        paragraphs: [
          'En la búsqueda aparecen primero los locales destacados y después el resto por orden alfabético. Un local está destacado si tiene contratado el plan Local, que incluye mayor visibilidad a cambio de su precio, o si Adelia lo selecciona manualmente. Por tanto, **parte de esa posición es de pago**.',
          'Esa lista se reparte en carruseles que pueden variar, y puedes cambiar el resultado con la búsqueda, los filtros, los favoritos o la opción de ordenar por cercanía. La puntuación de las reseñas no decide el orden general.',
          'El ranking de Compite se ordena por XP. Las promociones se muestran según su disponibilidad y, en la app, según tu cercanía.',
        ],
      },
      {
        heading: '6. Promociones',
        paragraphs: [
          'Las promociones las crea y responde de ellas cada restaurante: precio, cupos, horarios y requisitos. Pueden agotarse o retirarse.',
          'Si una promoción anuncia una rebaja de precio, el restaurante debe respetar la normativa de consumo y publicidad, incluida la referencia al precio anterior cuando sea aplicable.',
        ],
      },
      {
        heading: '7. Compite',
        paragraphs: [
          'XP, niveles, insignias, Adelinas, cartas e inventario son recompensas virtuales de la plataforma. No tienen valor monetario, no se pueden canjear por dinero ni transferir, y nunca se compran.',
          'Los retos y minijuegos entre amigos no requieren pago ni apuestas de dinero: lo que se decide en ellos es una ventaja dentro del juego.',
          'Podemos corregir saldos si hay errores técnicos o abusos. Algunas cartas pueden modificar temporalmente condiciones de fianza o penalización en el flujo de reserva; su efecto se indica antes de usarlas.',
        ],
      },
      {
        heading: '8. Contenidos prohibidos y cómo denunciarlos',
        paragraphs: [
          'No puedes publicar contenido ilícito, ofensivo, discriminatorio, engañoso, que infrinja derechos de terceros o que revele datos personales de otras personas sin necesidad. Tampoco suplantar a nadie, atacar el servicio o extraer datos de forma masiva.',
          `Cualquier persona puede denunciar un contenido con el enlace «Denunciar» de cada reseña o escribiendo a ${LEGAL_CONTACT_EMAIL}. Indica dónde está el contenido (enlace o local y fecha), por qué crees que es ilícito o contrario a estos términos, tu nombre y tu correo, y una declaración de que actúas de buena fe. Si lo que denuncias es un posible delito contra la libertad sexual de menores no hace falta que te identifiques.`,
          'Revisamos las denuncias personalmente, sin decisiones automatizadas, y te contestamos. Si retiramos un contenido o limitamos una cuenta, comunicamos a la persona afectada el motivo, los hechos y cómo reclamar. Puedes pedir la revisión de la decisión escribiendo al mismo correo. Podemos dejar de atender a quien presente denuncias manifiestamente infundadas de forma reiterada.',
          'También puedes acudir a los tribunales. Si una conducta pudiera ser delito grave para la vida o la seguridad de las personas, avisaremos a las autoridades.',
        ],
      },
      {
        heading: '9. Restaurantes: planes y pagos',
        paragraphs: [
          'El alta en Adelia es para negocios. Al usar el panel actúas como empresario o profesional, por lo que no se aplican los derechos propios de consumidores, como el desistimiento de 14 días.',
          'El plan Mesa es gratuito. Los planes Sala y Local se pagan por adelantado, mensual o anualmente, a los precios publicados en la página de planes. El cobro lo realiza Lemon Squeezy como comerciante registrado (merchant of record), que emite la factura, añade los impuestos que correspondan y muestra los métodos de pago disponibles. Si un plan incluye periodo de prueba se indica antes de pagar.',
          'La suscripción se renueva automáticamente hasta que la canceles desde tu zona de Plan. Si cancelas conservas el plan hasta el final del periodo pagado y después pasas a Mesa. Las devoluciones se rigen por las condiciones de Lemon Squeezy. Si borras la cuenta, cancelamos antes tu suscripción.',
          'Si cambias a un plan inferior o dejas de pagar, se desactivan automáticamente las funciones que excedan el nuevo plan (promociones, mapas, fianzas, cartas), sin borrar tus datos.',
          'Adelia no cobra comisión por reserva. Las fianzas se tramitan con tu propia cuenta de Stripe Connect, sujeta a las condiciones de Stripe.',
        ],
      },
      {
        heading: '10. Restaurantes: tus obligaciones',
        paragraphs: [
          'Eres responsable de que tu ficha, horarios, carta, precios y promociones sean exactos, de cumplir la normativa sanitaria, fiscal y de consumo, y de informar de los alérgenos de tus platos. Adelia te da el campo para indicarlos, pero el contenido es tuyo.',
          'Debes tener derechos sobre las fotos, logos y textos que subes, y nos autorizas a mostrarlos en Adelia para prestar el servicio mientras tu cuenta siga activa.',
          'Eres responsable de los datos de tus comensales. Adelia los trata por tu cuenta según el contrato de encargo de tratamiento, que forma parte de estos términos. Solo puedes enviarles publicidad con una base legal válida (art. 21 de la LSSI).',
          'Los bloques de promoción de tus correos son publicidad tuya. Solo debes activarlos para ofertas de tu propio local similares a lo ya contratado por el cliente.',
        ],
      },
      {
        heading: '11. Restaurantes: datos, cambios, suspensión y reclamaciones',
        paragraphs: [
          'Puedes acceder a las reservas, clientes, reseñas e informes de tu local, y a estadísticas de la app sobre tu ficha, carta y promociones. Adelia accede a los mismos datos para prestar y proteger el servicio, y a datos agregados de toda la plataforma. No compartimos los datos de tu local con otros restaurantes, salvo lo público en tu ficha y tu posición en el ranking de Compite.',
          'Adelia ofrece sus propios contenidos y no presta servicios en competencia con los restaurantes. Los locales de un mismo plan reciben las mismas condiciones, salvo la selección manual de destacados descrita en el apartado 5.',
          'Te avisaremos de los cambios en estos términos por correo o en el panel al menos 15 días antes de aplicarlos, salvo obligación legal o riesgo de seguridad. Si no estás de acuerdo puedes darte de baja antes de esa fecha.',
          'Si suspendemos o limitamos tu cuenta te daremos los motivos por escrito. Para terminar el servicio de forma definitiva avisaremos con al menos 30 días, salvo obligación legal, incumplimientos graves o reiterados o fraude. Puedes aclarar los hechos y pedir la revisión de la decisión.',
          `Las reclamaciones se atienden gratis en ${LEGAL_CONTACT_EMAIL}. Por el tamaño de Adelia no ofrecemos un sistema interno formal ni mediadores designados, pero cualquier controversia puede someterse de mutuo acuerdo a mediación.`,
        ],
      },
      {
        heading: '12. Disponibilidad y responsabilidad',
        paragraphs: [
          'Ponemos medios razonables para que el servicio funcione, pero puede haber interrupciones por mantenimiento o por fallos de proveedores.',
          'Si actúas como empresa, en la medida permitida por la ley no respondemos de lucro cesante ni de la pérdida de reservas por causas técnicas, y nuestra responsabilidad se limita a lo pagado a Adelia en los últimos 12 meses, salvo dolo o culpa grave.',
          'Nada en estos términos limita los derechos irrenunciables de consumidores y usuarios.',
        ],
      },
      {
        heading: '13. Cambios, ley aplicable y reclamaciones',
        paragraphs: [
          'Podemos actualizar estos términos. La fecha de la última versión aparece arriba, y te avisaremos en el servicio o por correo si el cambio es relevante.',
          `Se aplica la ley española. Si eres consumidor puedes reclamar en ${LEGAL_CONTACT_EMAIL}, ante los servicios de consumo de tu comunidad autónoma y ante los juzgados de tu domicilio. Adelia no está adherida a ningún sistema de resolución alternativa de litigios ni obligada a ello. Entre empresas son competentes los juzgados de Logroño, salvo norma imperativa en contrario.`,
        ],
      },
    ],
  },
  encargo: {
    id: 'encargo',
    title: 'Contrato de encargo de tratamiento',
    summary: 'Contrato entre cada restaurante (responsable) y Adelia (encargado) conforme al art. 28 del RGPD. Forma parte de los términos de uso y se acepta al dar de alta el restaurante.',
    sections: [
      {
        heading: '1. Partes y objeto',
        paragraphs: [
          `Responsable del tratamiento: el restaurante titular de la cuenta. Encargado del tratamiento: ${LEGAL_ENTITY.legalName} (NIF ${LEGAL_ENTITY.nif}), titular de Adelia.`,
          'El encargo cubre los datos de los comensales que el restaurante gestiona con el panel: reservas, ficha de clientes, consumos verificados, alojamiento de esos datos y envío de los correos de reserva. Dura lo mismo que el uso del panel.',
          'Adelia es responsable independiente de los datos de sus propias cuentas de comensal, de Compite, de la seguridad y de la analítica de la plataforma, según su política de privacidad.',
        ],
      },
      {
        heading: '2. Datos e interesados',
        paragraphs: [
          'Interesados: comensales y personas que reservan o consumen en el local.',
          'Datos: nombre, correo, teléfono, número de comensales, fecha y hora, mesa, comentarios, estado de la reserva, historial de visitas, consumos verificados e identificadores de la fianza. No es un tratamiento previsto para categorías especiales de datos: el restaurante no debe pedirlas a través de Adelia.',
        ],
      },
      {
        heading: '3. Obligaciones de Adelia',
        paragraphs: [
          'Tratar los datos solo siguiendo las instrucciones documentadas del restaurante, que son estos términos y el uso del panel, salvo obligación legal, de la que le informará antes si la ley lo permite. Avisará si cree que una instrucción infringe la normativa.',
          'Garantizar que quien acceda a los datos está obligado a confidencialidad.',
          'Aplicar medidas de seguridad adecuadas (art. 32 RGPD): cifrado en tránsito, autenticación, control de acceso por roles y reglas de acceso a la base de datos.',
          'Ayudar al restaurante a atender los derechos de los interesados, y trasladarle sin demora las solicitudes que reciba sobre sus datos.',
          'Notificar al restaurante sin dilación indebida, y si es posible en 48 horas, cualquier violación de seguridad que afecte a sus datos, con la información disponible para que pueda cumplir los arts. 33 y 34 RGPD.',
          'Ayudar con evaluaciones de impacto y consultas a la autoridad cuando proceda, y facilitar la información necesaria para demostrar el cumplimiento y permitir auditorías razonables, avisadas con antelación.',
        ],
      },
      {
        heading: '4. Subencargados',
        paragraphs: [
          'El restaurante autoriza a estos subencargados: Google (Firebase: alojamiento, base de datos y autenticación), Cloudinary (imágenes), Resend (correo transaccional) y Stripe (tramitación de fianzas).',
          'Adelia avisará de los cambios con al menos 15 días, y el restaurante podrá oponerse dándose de baja. Cada subencargado queda sujeto a obligaciones equivalentes. Cuando traten datos fuera del EEE, se aplicarán decisiones de adecuación o cláusulas contractuales tipo.',
        ],
      },
      {
        heading: '5. Obligaciones del restaurante',
        paragraphs: [
          'Tener base legal para el tratamiento, informar a sus clientes, atender sus derechos y no usar los datos para fines incompatibles ni enviar publicidad sin base legal.',
        ],
      },
      {
        heading: '6. Fin del encargo',
        paragraphs: [
          'Al eliminar la cuenta de restaurante, Adelia suprime sus reservas, fichas de clientes, consumos, reseñas, promociones y cartas. Antes de hacerlo, el restaurante puede exportar lo que necesite desde los informes o pedirlo por correo. Las copias en sistemas de los proveedores se eliminan según sus ciclos, y Adelia solo conserva lo que exija una obligación legal, debidamente bloqueado.',
        ],
      },
    ],
  },
  cookies: {
    id: 'cookies',
    title: 'Política de cookies',
    summary: 'Información exigida por el artículo 22.2 de la LSSI-CE y por la guía de la AEPD sobre cookies y tecnologías similares.',
    sections: [
      {
        heading: '1. Qué son',
        paragraphs: [
          'Las cookies son pequeños archivos que el sitio guarda en tu navegador. También usamos tecnologías similares, como el almacenamiento local.',
          `El responsable es el titular de Adelia, identificado en el aviso legal. Contacto: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: '2. Necesarias (no requieren consentimiento)',
        paragraphs: [
          'Sesión de Firebase Authentication (propia, almacenamiento local e IndexedDB): mantener tu sesión. Dura hasta que cierras sesión.',
          '`adelia.cookieConsent.v1` (propia, almacenamiento local): recordar tu elección sobre cookies. Dura 24 meses; después te volvemos a preguntar.',
          'Preferencias técnicas (propias, almacenamiento local): favoritos antes de entrar, estado de pantallas y del tutorial. Duran hasta que borras los datos del sitio.',
          'reCAPTCHA de Google (tercero): proteger el registro y otros formularios frente a bots. Solo se carga en esos formularios. Google puede tratar tu IP y datos del dispositivo según su [política de privacidad](https://policies.google.com/privacy).',
          'Si las bloqueas por completo en el navegador, es posible que no puedas entrar ni registrarte.',
        ],
      },
      {
        heading: '3. Analíticas (solo con tu consentimiento)',
        paragraphs: [
          '`_ga` y `_ga_*` (Google Analytics for Firebase, tercero): medir visitas y uso de pantallas. Duran hasta 2 años. Google puede tratar estos datos fuera del EEE, con las garantías de nuestra política de privacidad.',
          '`adelia_anon_id` (propia, almacenamiento local) y eventos de uso (ver ficha, carta, promociones, favoritos, inicio de reserva): mejorar Adelia y dar a cada restaurante informes agregados. Se asocian a tu cuenta si has entrado o a ese identificador aleatorio. Los eventos se borran a los 120 días.',
          'No las usamos para publicidad de terceros ni para crear perfiles publicitarios.',
        ],
      },
      {
        heading: '4. Otros servicios que intervienen',
        paragraphs: [
          'Al mostrar imágenes y mapas, tu navegador conecta con Cloudinary, MapTiler u OpenStreetMap, que pueden registrar tu IP para servir el contenido.',
          'En el pago de una fianza intervienen Stripe y sus cookies necesarias, y en la contratación de un plan, las de Lemon Squeezy, en su propio dominio.',
        ],
      },
      {
        heading: '5. Cómo aceptarlas, rechazarlas o cambiar de opinión',
        paragraphs: [
          'En el aviso de cookies puedes aceptar, rechazar o configurar, con la misma facilidad, y usar Adelia igual en cualquier caso. Tu elección se guarda en este navegador durante 24 meses.',
          'Puedes cambiarla cuando quieras con el botón «Cambiar preferencias de cookies» de esta página. Al retirar el consentimiento dejamos de medir y eliminamos las cookies analíticas y el identificador.',
          'También puedes borrar cookies y datos del sitio desde tu navegador: [Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/es/kb/Borrar%20cookies), [Safari](https://support.apple.com/es-es/guide/safari/sfri11471/mac) o [Edge](https://support.microsoft.com/es-es/microsoft-edge).',
          'Más información en la política de privacidad.',
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
    || value === 'encargo'
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
