/** Mismo criterio que el servidor (server/data/usernames.ts): nombres de persona, sin números. */
export function personNameError(value: string): string | null {
  const name = value.replace(/\s+/g, ' ').trim()
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return 'Escribe tu nombre (al menos 2 letras).'
  if (/\p{N}/u.test(name)) return 'El nombre no puede llevar números.'
  if (!/^[\p{L}\p{M} .'’-]+$/u.test(name)) return 'El nombre solo puede llevar letras, espacios y guiones.'
  return null
}
