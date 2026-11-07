import type { ReactNode } from 'react'

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g

/** Formato mínimo de los textos legales: **negrita**, `código` y [enlace](https://…). */
export function renderLegalText(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(INLINE)) {
    const index = match.index
    if (index > cursor) {
      nodes.push(text.slice(cursor, index))
    }
    const [whole, bold, code, label, href] = match
    if (bold) {
      nodes.push(<strong key={index}>{bold}</strong>)
    } else if (code) {
      nodes.push(<code key={index}>{code}</code>)
    } else {
      nodes.push(<a key={index} href={href} target="_blank" rel="noreferrer">{label}</a>)
    }
    cursor = index + whole.length
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }
  return nodes
}
