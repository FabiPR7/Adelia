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
export const LEGAL_UPDATED_LABEL = '16 de agosto de 2026'

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
          CONTACT,
          'Los datos identificativos de la entidad titular (denominación social, NIF y domicilio) se publicarán en este aviso en cuanto estén formalizados. Mientras tanto, cualquier comunicación legal, de consumidores o de protección de datos puede dirigirse a la dirección de correo anterior.',
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
    summary: 'Información sobre el tratamiento de datos personales conforme al RGPD y a la Ley Orgánica 3/2018 (LOPDGDD).',
    sections: [
      {
        heading: '1. Quién trata tus datos',
        paragraphs: [
          `El responsable del tratamiento de los datos de la plataforma Adelia (cuentas, reservas gestionadas en la app, gamificación, comunicaciones de Adelia y analítica con tu consentimiento) puede contactarse en ${LEGAL_CONTACT_EMAIL}.`,
          'Cuando reservas en un restaurante, ese establecimiento trata tus datos como responsable de la reserva y de la atención en el local (nombre, contacto, comensales, fecha, mesa, comentarios, fianza si la hay). Adelia actúa entonces como encargado o como medio técnico para que el restaurante gestione esa reserva.',
          'Si tienes cuenta de restaurante, tratamos los datos de tu negocio para prestarte el panel (nombre del local, contacto, carta, mesas, reservas, clientes, reseñas e informes).',
        ],
      },
      {
        heading: '2. Datos que recogemos',
        paragraphs: [
          'Cuenta de comensal: nombre, email, teléfono, contraseña (almacenada de forma cifrada por el proveedor de autenticación), foto de perfil si la subes, ciudad o zona, preferencias alimentarias, restaurantes favoritos y datos de Compite (XP, nivel, inventario, Adelinas).',
          'Reserva (con o sin cuenta): nombre, teléfono o email, número de comensales, fecha y hora, mesa, comentarios, estado de la reserva y, si el restaurante lo activa, datos de fianza o pago a través de Stripe.',
          'Reseñas: nota, texto, fotos o vídeos que subas, productos o promociones etiquetados y Adelinas asociadas.',
          'Restaurante: datos de contacto y ficha pública, mesas, horarios, carta, promociones, plantillas de correo, historial de clientes del local e informes de actividad.',
          'Técnicos: identificadores de sesión, dirección IP, tipo de dispositivo, registros de seguridad y, solo si aceptas cookies analíticas, métricas de uso de Firebase Analytics.',
          'Ubicación: si usas «cerca de mí», el navegador puede enviar coordenadas en tu dispositivo para ordenar restaurantes. No las usamos para perfilado publicitario.',
        ],
      },
      {
        heading: '3. Para qué y con qué base legal',
        paragraphs: [
          'Prestarte el servicio (crear cuenta, reservar, cancelar, ver promos, reseñar, usar Compite, gestionar el panel): ejecución de contrato (art. 6.1.b RGPD).',
          'Fianzas y pagos: ejecución del contrato y obligaciones contables y de prevención de fraude, a través de Stripe como proveedor de pago.',
          'Seguridad, prevención de abusos y mejora técnica del servicio: interés legítimo (art. 6.1.f), ponderado con tus derechos.',
          'Cookies no esenciales y analítica: tu consentimiento (art. 6.1.a), que puedes retirar cuando quieras.',
          'Obligaciones legales (facturación, reclamaciones, requerimientos de autoridad): art. 6.1.c.',
          'Emails transaccionales de reserva (recibida, confirmada, cancelada): necesarios para el servicio. No enviamos publicidad de Adelia a comensales sin una base adecuada; las promociones las publica el restaurante en la app.',
        ],
      },
      {
        heading: '4. Destinatarios y encargados',
        paragraphs: [
          'El restaurante donde reservas recibe los datos necesarios para atenderte.',
          'Google Firebase (Google Cloud / Firebase Authentication, Firestore, Hosting y, si consientes, Analytics) trata datos como encargado para alojar y autenticar el servicio. Puede haber transferencias internacionales amparadas por las cláusulas contractuales tipo de la Comisión Europea y las medidas de Google.',
          'Stripe, si hay fianza o pago: trata los datos de pago como proveedor especializado. Adelia no almacena el número completo de tu tarjeta.',
          'Resend u otro proveedor de correo, para enviar confirmaciones de reserva.',
          'No vendemos tus datos a terceros para su publicidad.',
        ],
      },
      {
        heading: '5. Conservación',
        paragraphs: [
          'La cuenta se mantiene mientras esté activa. Si pides la baja, eliminamos o anonimizamos lo que no debamos conservar por ley.',
          'Las reservas y reseñas se conservan el tiempo necesario para el restaurante, para Compite y para obligaciones legales (por ejemplo, reclamaciones o facturación).',
          'Los registros de seguridad se conservan el plazo mínimo útil para investigar incidencias.',
        ],
      },
      {
        heading: '6. Tus derechos',
        paragraphs: [
          'Tienes derecho de acceso, rectificación, supresión, oposición, limitación, portabilidad y a no ser objeto de una decisión automatizada con efectos jurídicos. También puedes retirar el consentimiento de cookies analíticas.',
          `Para ejercerlos, escribe a ${LEGAL_CONTACT_EMAIL} indicando el derecho y un medio de contacto. Si el dato lo trata el restaurante (por ejemplo, una reserva concreta), puedes dirigirte también a ese local.`,
          'Puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
      },
      {
        heading: '7. Menores',
        paragraphs: [
          'Adelia no está dirigida a menores de 14 años. Si detectamos una cuenta de un menor por debajo de esa edad, la cancelaremos. En España, el consentimiento del menor para la sociedad de la información se admite a partir de 14 años (LOPDGDD).',
        ],
      },
      {
        heading: '8. Restaurantes',
        paragraphs: [
          'Si usas el panel, eres responsable de informar a tus comensales sobre cómo tratas sus datos (cartas, cartelería, tu propia política si tienes web) y de usar Adelia solo para gestionar tu local.',
          'No debes importar bases de datos sin base legal ni usar el historial de clientes para finalidades ajenas a la hostelería y a la reserva.',
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
    summary: 'Información exigida por el artículo 22.2 de la LSSI-CE y por las directrices de la AEPD sobre cookies.',
    sections: [
      {
        heading: '1. Qué son',
        paragraphs: [
          'Las cookies son pequeños archivos que el sitio guarda en tu navegador. También usamos tecnologías similares (almacenamiento local o identificadores del SDK) para sesión y preferencias.',
        ],
      },
      {
        heading: '2. Cookies necesarias',
        paragraphs: [
          'Son imprescindibles para iniciar sesión, mantener tu sesión de Firebase Authentication, recordar si ya respondiste al banner de cookies y proteger el servicio. No requieren consentimiento según la AEPD, porque permiten la comunicación o un servicio que has pedido.',
          'Si las bloqueas por completo en el navegador, es posible que no puedas entrar ni reservar con cuenta.',
        ],
      },
      {
        heading: '3. Cookies analíticas (opcionales)',
        paragraphs: [
          'Si las aceptas, activamos Firebase Analytics (Google) para medir visitas y uso agregado de pantallas, con el identificador de medición configurado en el proyecto. Nos ayuda a mejorar Adelia, no a vender publicidad de terceros.',
          'Estas cookies solo se instalan con tu consentimiento. Puedes rechazarlas o cambiar de opinión más tarde en este mismo documento, con el botón de preferencias, o en el aviso de cookies.',
        ],
      },
      {
        heading: '4. Cómo gestionarlas',
        paragraphs: [
          'En el banner puedes aceptar todas, rechazar las opcionales o configurarlas. Tu elección se guarda en este navegador.',
          'También puedes borrar cookies desde la configuración de Chrome, Safari, Firefox o Edge. El rechazo de analítica no impide usar Adelia.',
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
  return value
}
