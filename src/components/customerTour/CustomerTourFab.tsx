import { createPortal } from 'react-dom'
import styles from './CustomerTourFab.module.css'

interface CustomerTourFabProps {
  onClick: () => void
}

function CustomerTourFab({ onClick }: CustomerTourFabProps) {
  return createPortal(
    <button type="button" className={styles.fab} onClick={onClick}>
      Ver animación
    </button>,
    document.body,
  )
}

export default CustomerTourFab
