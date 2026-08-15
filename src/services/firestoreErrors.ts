export function getFirestoreErrorMessage(
  error: unknown,
  context: 'load' | 'save' = 'load',
): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return context === 'save'
        ? 'Sin permiso para guardar. Publica las reglas en la base de datos «adelia» (Firebase Console → Firestore → adelia → Reglas).'
        : 'Sin permiso para leer Firestore. Revisa las reglas en Firebase Console.'
    }

    if (error.code === 'unavailable' || error.code === 'not-found') {
      return 'Firestore no está disponible. Crea la base de datos «adelia» y ejecuta npm run seed.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return context === 'save'
    ? 'No se pudieron guardar los cambios.'
    : 'No se pudieron cargar los datos.'
}
