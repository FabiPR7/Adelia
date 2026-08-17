import type { InventoryEmblem } from '../data/inventoryItems'
import styles from './InventoryItemCard.module.css'

function InventoryItemEmblem({ emblem }: { emblem: InventoryEmblem }) {
  if (emblem === 'shield') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M32 6.5 52 15.2v16.4c0 12.4-8.2 21.6-20 25.9C20.2 53.2 12 44 12 31.6V15.2L32 6.5Z" />
        <path className={styles.emblemStroke} d="M32 8.2 50.2 16v15.6c0 11.2-7.3 19.6-18.2 23.5C21.1 51.2 13.8 42.8 13.8 31.6V16L32 8.2Z" />
        <path className={styles.emblemStroke} d="M22 29.5h20M24 29.5V39M40 29.5V39M20.5 39h23" />
      </svg>
    )
  }

  if (emblem === 'cloche') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <ellipse className={styles.emblemFill} cx="32" cy="46" rx="20" ry="5.5" />
        <path className={styles.emblemStroke} d="M12.5 46c0-14.2 8.7-27 19.5-27s19.5 12.8 19.5 27" />
        <path className={styles.emblemStroke} d="M32 12.5v6.5M28.5 12.5h7" />
        <ellipse className={styles.emblemStroke} cx="32" cy="46" rx="20" ry="5.5" />
      </svg>
    )
  }

  if (emblem === 'cutlery') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <ellipse className={styles.emblemFill} cx="32" cy="34" rx="11" ry="11" />
        <ellipse className={styles.emblemStroke} cx="32" cy="34" rx="11" ry="11" />
        <path className={styles.emblemStroke} d="M14 16.5v10.5c0 3.2-1.6 5.2-3.4 5.2V52" />
        <path className={styles.emblemStroke} d="M50.5 16.5 48 28.5V52M53.6 16.5 51.2 28.5" />
      </svg>
    )
  }

  if (emblem === 'key') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.emblemFill} cx="24" cy="24" r="11" />
        <circle className={styles.emblemStroke} cx="24" cy="24" r="11" />
        <circle className={styles.emblemStroke} cx="24" cy="24" r="4.5" />
        <path className={styles.emblemStroke} d="M33 28.5 52 47.5M46 41.5h7M49.5 45v7" />
      </svg>
    )
  }

  if (emblem === 'ticket') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M12 20h40v8c-3 0-5 2.2-5 4.5S49 37 52 37v8H12v-8c3 0 5-2.2 5-4.5S15 28 12 28V20Z" />
        <path className={styles.emblemStroke} d="M12 20h40v8c-3 0-5 2.2-5 4.5S49 37 52 37v8H12v-8c3 0 5-2.2 5-4.5S15 28 12 28V20Z" />
        <path className={styles.emblemStroke} d="M24 26v20" strokeDasharray="2 3" />
      </svg>
    )
  }

  if (emblem === 'compass') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.emblemFill} cx="32" cy="32" r="18" />
        <circle className={styles.emblemStroke} cx="32" cy="32" r="18" />
        <path className={styles.emblemStroke} d="M32 16v4M32 44v4M16 32h4M44 32h4" />
        <path className={styles.emblemFill} d="M32 22 38 38 32 34 26 38Z" />
      </svg>
    )
  }

  if (emblem === 'glass') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M20 12h24l-4 22H24L20 12Z" />
        <path className={styles.emblemStroke} d="M20 12h24l-4 22H24L20 12ZM32 34v14M24 52h16" />
      </svg>
    )
  }

  if (emblem === 'note') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M18 12h22l8 8v32H18V12Z" />
        <path className={styles.emblemStroke} d="M18 12h22l8 8v32H18V12ZM40 12v8h8" />
        <path className={styles.emblemStroke} d="M24 30h16M24 37h16M24 44h10" />
      </svg>
    )
  }

  if (emblem === 'lock') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <rect className={styles.emblemFill} x="16" y="28" width="32" height="24" rx="4" />
        <path className={styles.emblemStroke} d="M20 28h24v24H20z" />
        <path className={styles.emblemStroke} d="M22 28v-6a10 10 0 0 1 20 0v6" />
        <circle className={styles.emblemStroke} cx="32" cy="40" r="3" />
      </svg>
    )
  }

  if (emblem === 'spark') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M32 8 36 26 54 32 36 38 32 56 28 38 10 32 28 26Z" />
        <path className={styles.emblemStroke} d="M32 8 36 26 54 32 36 38 32 56 28 38 10 32 28 26Z" />
      </svg>
    )
  }

  if (emblem === 'pax') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.emblemFill} cx="24" cy="22" r="8" />
        <circle className={styles.emblemStroke} cx="24" cy="22" r="8" />
        <path className={styles.emblemStroke} d="M10 50c1.5-10 7-16 14-16s12.5 6 14 16" />
        <circle className={styles.emblemStroke} cx="44" cy="24" r="6" />
        <path className={styles.emblemStroke} d="M38 50c1-8 5-13 10-13 4 0 7 3 8 8" />
      </svg>
    )
  }

  if (emblem === 'clock') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.emblemFill} cx="32" cy="32" r="18" />
        <circle className={styles.emblemStroke} cx="32" cy="32" r="18" />
        <path className={styles.emblemStroke} d="M32 20v13l9 6" />
      </svg>
    )
  }

  if (emblem === 'deposit') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <rect className={styles.emblemFill} x="14" y="16" width="36" height="32" rx="3" />
        <path className={styles.emblemStroke} d="M14 16h36v32H14z" />
        <path className={styles.emblemStroke} d="M22 26h20M22 34h14M22 42h10" />
      </svg>
    )
  }

  if (emblem === 'ghost') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M32 10c11 0 18 8 18 20v22l-6-4-6 4-6-4-6 4-6-4-6 4V30c0-12 7-20 18-20Z" />
        <path className={styles.emblemStroke} d="M32 10c11 0 18 8 18 20v22l-6-4-6 4-6-4-6 4-6-4-6 4V30c0-12 7-20 18-20Z" />
        <circle className={styles.emblemStroke} cx="26" cy="28" r="2.2" />
        <circle className={styles.emblemStroke} cx="38" cy="28" r="2.2" />
      </svg>
    )
  }

  if (emblem === 'napkin') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.emblemFill} d="M14 18 32 12 50 18 46 52 18 52Z" />
        <path className={styles.emblemStroke} d="M14 18 32 12 50 18 46 52 18 52Z" />
        <path className={styles.emblemStroke} d="M32 12v40" />
      </svg>
    )
  }

  if (emblem === 'crumb' || emblem === 'junk') {
    return (
      <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.emblemFill} cx="28" cy="30" r="10" />
        <circle className={styles.emblemStroke} cx="28" cy="30" r="10" />
        <circle className={styles.emblemStroke} cx="40" cy="38" r="6" />
        <circle className={styles.emblemStroke} cx="22" cy="42" r="3.5" />
      </svg>
    )
  }

  return (
    <svg className={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
      <circle className={styles.emblemFill} cx="32" cy="32" r="20" />
      <circle className={styles.emblemStroke} cx="32" cy="32" r="20" />
      <circle className={styles.emblemStroke} cx="32" cy="32" r="15.5" />
      <path className={styles.emblemStroke} d="M21 30.5h22M23.2 30.5V42M41 30.5V42M19.5 42h25" />
    </svg>
  )
}

export default InventoryItemEmblem
