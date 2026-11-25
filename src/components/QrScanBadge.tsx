import { ScanLine } from 'lucide-react'
import { formatNumber } from '../utils/formatNumber'
import styles from './QrScanBadge.module.css'

/** Escaneos de un QR este mes, junto a su vista previa o su botón de descarga. */
function QrScanBadge({ count, className }: { count: number; className?: string }) {
  const active = count > 0
  return (
    <span
      className={`${styles.badge} ${active ? styles.active : ''} ${className ?? ''}`}
      title="Veces que se ha escaneado este QR en lo que va de mes"
    >
      {active ? <span className={styles.dot} aria-hidden="true" /> : <ScanLine size={13} aria-hidden="true" />}
      {active ? (
        <>
          <strong>{formatNumber(count)}</strong> {count === 1 ? 'escaneo' : 'escaneos'} este mes
        </>
      ) : (
        'Sin escaneos este mes'
      )}
    </span>
  )
}

export default QrScanBadge
