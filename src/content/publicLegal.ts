export type PublicLegalDocId = 'privacidad' | 'terminos' | 'cookies'

export interface PublicLegalDocument {
  id: PublicLegalDocId
  title: string
  sections: Array<{ heading: string; body: string }>
}

export const PUBLIC_LEGAL_DOCUMENTS: Record<PublicLegalDocId, PublicLegalDocument> = {
  privacidad: {
    id: 'privacidad',
    title: 'Política de privacidad',
    sections: [
      {
        heading: 'Responsable',
        body: 'Adelia («nosotros») trata los datos personales necesarios para gestionar reservas en restaurantes que utilizan nuestra plataforma. El restaurante donde realizas la reserva también puede tratar tus datos como responsable de la reserva.',
      },
      {
        heading: 'Datos que recogemos',
        body: 'Al reservar podemos recoger nombre, teléfono, correo electrónico, número de comensales, fecha y hora de la reserva, mesa seleccionada y comentarios opcionales que indiques.',
      },
      {
        heading: 'Finalidad',
        body: 'Usamos estos datos para confirmar y gestionar tu reserva, comunicarnos contigo si es necesario y mejorar el servicio. El restaurante utilizará tus datos para atender la reserva en su local.',
      },
      {
        heading: 'Conservación',
        body: 'Conservamos los datos el tiempo necesario para la gestión de la reserva y las obligaciones legales aplicables.',
      },
      {
        heading: 'Tus derechos',
        body: 'Puedes solicitar acceso, rectificación o supresión de tus datos contactando con el restaurante o escribiendo a privacidad@adelia.app.',
      },
    ],
  },
  terminos: {
    id: 'terminos',
    title: 'Términos de uso',
    sections: [
      {
        heading: 'Servicio',
        body: 'Adelia facilita la reserva online en restaurantes asociados. Al usar esta página aceptas estos términos y la política de privacidad.',
      },
      {
        heading: 'Reservas',
        body: 'Al confirmar una reserva te comprometes a acudir en la fecha y hora indicadas o a cancelar con la antelación que indique el restaurante. El restaurante es responsable de la atención en el local.',
      },
      {
        heading: 'Exactitud de los datos',
        body: 'Debes facilitar información veraz y un medio de contacto válido (teléfono o correo) para que el restaurante pueda gestionar tu reserva.',
      },
      {
        heading: 'Disponibilidad',
        body: 'La disponibilidad mostrada es orientativa y puede cambiar. Nos reservamos el derecho a corregir errores técnicos o cancelar reservas duplicadas o fraudulentas.',
      },
      {
        heading: 'Limitación',
        body: 'Adelia no se hace responsable de incidencias en el servicio del restaurante, cambios de horario o cancelaciones por parte del establecimiento.',
      },
    ],
  },
  cookies: {
    id: 'cookies',
    title: 'Política de cookies',
    sections: [
      {
        heading: 'Qué son',
        body: 'Las cookies son pequeños archivos que el navegador almacena para que la web funcione correctamente o recordar preferencias.',
      },
      {
        heading: 'Cookies que usamos',
        body: 'Utilizamos cookies técnicas necesarias para la sesión, la seguridad y el funcionamiento del formulario de reserva. También podemos usar cookies de Firebase para autenticación y almacenamiento cuando corresponda.',
      },
      {
        heading: 'Gestión',
        body: 'Puedes configurar tu navegador para bloquear o eliminar cookies. Algunas funciones de la página podrían dejar de funcionar si desactivas las cookies técnicas.',
      },
    ],
  },
}

export function isPublicLegalDocId(value: string | undefined): value is PublicLegalDocId {
  return value === 'privacidad' || value === 'terminos' || value === 'cookies'
}
