import { useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import type { ReviewTaggedProduct, ReviewTaggedPromotion } from '../types/review'
import {
  REVIEW_PRODUCT_TAG_PATTERN,
  REVIEW_PROMO_TAG_PATTERN,
  serializeReviewCommentEditor,
} from '../utils/reviewCommentTags'
import styles from './ReviewCommentEditor.module.css'

interface ReviewCommentEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  editorRef?: React.RefObject<HTMLDivElement | null>
  onCaretCapture?: (offset: number) => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function markersToEditorHtml(comment: string): string {
  if (!comment) {
    return ''
  }

  let html = escapeHtml(comment)

  html = html.replace(
    new RegExp(REVIEW_PRODUCT_TAG_PATTERN.source, 'g'),
    (_full, boardId: string, nodeId: string, name: string) =>
      `<span class="${styles.inlineTag}" contenteditable="false" data-tag-type="product" data-board-id="${boardId}" data-node-id="${nodeId}">${escapeHtml(name)}</span>`,
  )

  html = html.replace(
    new RegExp(REVIEW_PROMO_TAG_PATTERN.source, 'g'),
    (_full, promotionId: string, name: string) =>
      `<span class="${styles.inlineTag}" contenteditable="false" data-tag-type="promotion" data-promotion-id="${promotionId}">${escapeHtml(name)}</span>`,
  )

  return html
}

function serializedLengthOfNode(node: Node): number {
  const temp = document.createElement('div')
  temp.appendChild(node.cloneNode(true))
  return serializeReviewCommentEditor(temp).length
}

/** Posición del cursor en el comentario serializado (donde se insertará la etiqueta). */
export function captureReviewEditorCaret(editor: HTMLDivElement | null): number {
  if (!editor) {
    return 0
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return serializeReviewCommentEditor(editor).length
  }

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) {
    return serializeReviewCommentEditor(editor).length
  }

  const preRange = range.cloneRange()
  preRange.selectNodeContents(editor)
  preRange.setEnd(range.startContainer, range.startOffset)

  const temp = document.createElement('div')
  temp.appendChild(preRange.cloneContents())
  return serializeReviewCommentEditor(temp).length
}

function createRangeAtSerializedOffset(editor: HTMLDivElement, offset: number): Range {
  const range = document.createRange()
  let pos = 0

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      const nextPos = pos + text.length

      if (offset <= nextPos) {
        range.setStart(node, Math.max(0, offset - pos))
        range.collapse(true)
        return true
      }

      pos = nextPos
      return false
    }

    if (node instanceof HTMLElement && node.dataset.tagType) {
      const tagLength = serializedLengthOfNode(node)
      const nextPos = pos + tagLength

      if (offset <= pos) {
        range.setStartBefore(node)
        range.collapse(true)
        return true
      }

      if (offset < nextPos) {
        range.setStartAfter(node)
        range.collapse(true)
        return true
      }

      if (offset === nextPos) {
        range.setStartAfter(node)
        range.collapse(true)
        return true
      }

      pos = nextPos
      return false
    }

    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) {
        return true
      }
    }

    return false
  }

  for (const child of Array.from(editor.childNodes)) {
    if (walk(child)) {
      return range
    }
  }

  range.selectNodeContents(editor)
  range.collapse(false)
  return range
}

function restoreCaretAtOffset(editor: HTMLDivElement, offset: number) {
  const range = createRangeAtSerializedOffset(editor, offset)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return range
}

function ReviewCommentEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Platos, ambiente, servicio…',
  editorRef: externalRef,
  onCaretCapture,
}: ReviewCommentEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const editorRef = externalRef ?? internalRef
  const isComposingRef = useRef(false)

  const syncEditorFromValue = useCallback((comment: string) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const serialized = serializeReviewCommentEditor(editor)
    if (serialized === comment) {
      return
    }

    const html = markersToEditorHtml(comment)
    editor.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['data-tag-type', 'data-board-id', 'data-node-id', 'data-promotion-id', 'class'],
    })
  }, [editorRef])

  useEffect(() => {
    if (!isComposingRef.current) {
      syncEditorFromValue(value)
    }
  }, [value, syncEditorFromValue])

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    onChange(serializeReviewCommentEditor(editor))
  }

  const captureCaret = () => {
    if (!onCaretCapture || !editorRef.current) {
      return
    }

    onCaretCapture(captureReviewEditorCaret(editorRef.current))
  }

  const handleInput = () => {
    if (!disabled) {
      emitChange()
      captureCaret()
    }
  }

  return (
    <div
      ref={editorRef}
      className={`${styles.editor} ${disabled ? styles.editorDisabled : ''}`}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="true"
      aria-label="Comentario de la reseña"
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleInput}
      onMouseUp={captureCaret}
      onKeyUp={captureCaret}
      onClick={captureCaret}
      onCompositionStart={() => {
        isComposingRef.current = true
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false
        emitChange()
        captureCaret()
      }}
    />
  )
}

export function insertProductTagInEditor(
  editor: HTMLDivElement | null,
  tag: ReviewTaggedProduct,
  onChange: (value: string) => void,
  caretOffset?: number | null,
): number {
  if (!editor) {
    return caretOffset ?? 0
  }

  const offset = caretOffset ?? captureReviewEditorCaret(editor)
  editor.focus()
  restoreCaretAtOffset(editor, offset)

  insertTagHtmlAtSelection(editor, tag.name, {
    tagType: 'product',
    boardId: tag.boardId,
    nodeId: tag.nodeId,
  })

  const serialized = serializeReviewCommentEditor(editor)
  onChange(serialized)
  return captureReviewEditorCaret(editor)
}

export function insertPromotionTagInEditor(
  editor: HTMLDivElement | null,
  tag: ReviewTaggedPromotion,
  onChange: (value: string) => void,
  caretOffset?: number | null,
): number {
  if (!editor) {
    return caretOffset ?? 0
  }

  const offset = caretOffset ?? captureReviewEditorCaret(editor)
  editor.focus()
  restoreCaretAtOffset(editor, offset)

  insertTagHtmlAtSelection(editor, tag.name, {
    tagType: 'promotion',
    promotionId: tag.promotionId,
  })

  const serialized = serializeReviewCommentEditor(editor)
  onChange(serialized)
  return captureReviewEditorCaret(editor)
}

function insertTagHtmlAtSelection(
  editor: HTMLDivElement,
  label: string,
  attrs: {
    tagType: 'product' | 'promotion'
    boardId?: string
    nodeId?: string
    promotionId?: string
  },
) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return
  }

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) {
    return
  }

  range.deleteContents()

  const tagElement = createTagElement(label, attrs)
  const trailingSpace = document.createTextNode(' ')

  const needsLeadingSpace = (() => {
    const preRange = range.cloneRange()
    preRange.selectNodeContents(editor)
    preRange.setEnd(range.startContainer, range.startOffset)
    const temp = document.createElement('div')
    temp.appendChild(preRange.cloneContents())
    const beforeText = serializeReviewCommentEditor(temp)
    return beforeText.length > 0 && !/\s$/.test(beforeText)
  })()

  if (needsLeadingSpace) {
    range.insertNode(document.createTextNode(' '))
  }

  range.insertNode(trailingSpace)
  range.insertNode(tagElement)

  range.setStartAfter(trailingSpace)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function createTagElement(
  label: string,
  attrs: {
    tagType: 'product' | 'promotion'
    boardId?: string
    nodeId?: string
    promotionId?: string
  },
) {
  const span = document.createElement('span')
  span.className = styles.inlineTag
  span.contentEditable = 'false'
  span.dataset.tagType = attrs.tagType
  span.textContent = label

  if (attrs.tagType === 'product') {
    span.dataset.boardId = attrs.boardId ?? ''
    span.dataset.nodeId = attrs.nodeId ?? ''
  } else {
    span.dataset.promotionId = attrs.promotionId ?? ''
  }

  return span
}

export default ReviewCommentEditor
