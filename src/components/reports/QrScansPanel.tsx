import { useEffect, useState } from 'react'
import { BookOpen, CalendarCheck, Download, QrCode, Tag, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { downloadBookingQrCode } from '../../utils/bookingQr'
import { formatNumber } from '../../utils/formatNumber'
import {
  getPublicBookingUrl,
  getPublicMenuBoardUrl,
  getPublicPromotionLandingUrl,
  slugify,
  withQrMark,
} from '../../utils/helpers'
import { resolveBrandedQrOptions } from '../../utils/qrBranding'
import styles from './QrScansPanel.module.css'

export interface QrScanItem {
  id: string
  name: string
  qrScans: number
}

interface QrScansPanelProps {
  total: number
  previousTotal: number
  reservas: number
  carta: number
  promo: number
  reservationsFromQr: number
  daily: { day: string; qrScans: number }[]
  boards: QrScanItem[]
  promos: QrScanItem[]
  periodLabel: string
}

/** Miniatura del QR (sin marca de diseño: solo para reconocerlo). */
function useQrThumb(url: string): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    let cancelled = false
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, { margin: 0, width: 160, color: { dark: '#3d3229', light: '#ffffff' } }),
      )
      .then((data) => {
        if (!cancelled) setSrc(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [url])
  return src
}

function QrTile({
  icon: Icon,
  label,
  hint,
  count,
  total,
  url,
  items,
  onDownload,
  downloading,
}: {
  icon: typeof QrCode
  label: string
  hint: string
  count: number
  total: number
  url: string
  items?: QrScanItem[]
  onDownload?: () => void
  downloading?: boolean
}) {
  const thumb = useQrThumb(url)
  const share = total > 0 ? Math.round((count / total) * 100) : 0
  const topItems = (items ?? []).filter((item) => item.qrScans > 0).slice(0, 3)

  return (
    <article className={styles.tile}>
      <div className={styles.tileTop}>
        <div className={styles.thumb} aria-hidden="true">
          {thumb ? <img src={thumb} alt="" /> : <QrCode size={26} />}
        </div>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>
            <Icon size={14} aria-hidden="true" />
            {label}
          </span>
          <strong className={styles.tileCount}>{formatNumber(count)}</strong>
          <span className={styles.tileHint}>{count === 1 ? 'escaneo' : 'escaneos'}</span>
        </div>
      </div>

      <div className={styles.shareRow}>
        <span className={styles.shareTrack}>
          <span className={styles.shareFill} style={{ transform: `scaleX(${share / 100})` }} />
        </span>
        <span className={styles.sharePct}>{share} %</span>
      </div>

      {topItems.length > 0 ? (
        <ul className={styles.itemList}>
          {topItems.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <strong>{formatNumber(item.qrScans)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.tileNote}>{hint}</p>
      )}

      {onDownload ? (
        <button type="button" className={styles.download} onClick={onDownload} disabled={downloading}>
          <Download size={15} aria-hidden="true" />
          {downloading ? 'Preparando…' : 'Descargar QR'}
        </button>
      ) : null}
    </article>
  )
}

function QrScansPanel({
  total,
  previousTotal,
  reservas,
  carta,
  promo,
  reservationsFromQr,
  daily,
  boards,
  promos,
  periodLabel,
}: QrScansPanelProps) {
  const { company } = useAuth()
  const [downloading, setDownloading] = useState(false)

  const slug = company?.slug ?? ''
  const bookingUrl = slug ? withQrMark(getPublicBookingUrl(slug), 'reservas') : ''
  const topBoard = boards.find((item) => item.qrScans > 0) ?? boards[0]
  const topPromo = promos.find((item) => item.qrScans > 0) ?? promos[0]
  const boardUrl = slug && topBoard ? withQrMark(getPublicMenuBoardUrl(slug, topBoard.id), 'carta') : ''
  const promoUrl = slug && topPromo ? withQrMark(getPublicPromotionLandingUrl(slug, topPromo.id), 'promo') : ''

  const delta = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null
  const conversion = total > 0 ? Math.round((reservationsFromQr / total) * 100) : 0
  const maxDay = Math.max(1, ...daily.map((point) => point.qrScans))

  const downloadBookingQr = async () => {
    if (!company || !bookingUrl) return
    setDownloading(true)
    try {
      const options = resolveBrandedQrOptions(company.qrBranding.booking, 'booking', {
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
      })
      await downloadBookingQrCode(bookingUrl, `qr-reservas-${slugify(company.slug || company.name)}.png`, options)
    } catch {
      // Si falla, el botón vuelve a estar disponible.
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="qr-scans-title">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <QrCode size={18} />
        </span>
        <div>
          <h2 id="qr-scans-title">Tus códigos QR</h2>
          <p>Cuánta gente escanea los QR que tienes en mesas, barra o escaparate · {periodLabel}</p>
        </div>
      </header>

      <div className={styles.hero}>
        <div className={styles.heroNumber}>
          <strong>{formatNumber(total)}</strong>
          <span>{total === 1 ? 'escaneo' : 'escaneos'}</span>
          {delta !== null ? (
            <span className={`${styles.delta} ${delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
              {delta >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
              {delta >= 0 ? '+' : ''}{delta} % que el periodo anterior
            </span>
          ) : null}
          <p className={styles.heroConversion}>
            <CalendarCheck size={15} aria-hidden="true" />
            <span>
              <b>{formatNumber(reservationsFromQr)}</b> {reservationsFromQr === 1 ? 'reserva' : 'reservas'} después de escanear
              {total > 0 ? <em> · {conversion} %</em> : null}
            </span>
          </p>
        </div>

        <div className={styles.spark} role="img" aria-label="Escaneos por día">
          {daily.length === 0 ? (
            <span className={styles.sparkEmpty}>Aquí verás los escaneos de cada día.</span>
          ) : (
            daily.map((point) => (
              <span
                key={point.day}
                className={styles.sparkCol}
                title={`Día ${Number(point.day.slice(8))}: ${point.qrScans} ${point.qrScans === 1 ? 'escaneo' : 'escaneos'}`}
              >
                <span
                  className={`${styles.sparkBar} ${point.qrScans === 0 ? styles.sparkBarZero : ''}`}
                  style={{ transform: `scaleY(${Math.max(0.04, point.qrScans / maxDay)})` }}
                />
              </span>
            ))
          )}
        </div>
      </div>

      {total === 0 ? (
        <p className={styles.emptyNote}>
          Todavía nadie ha escaneado tus QR. Imprímelos y ponlos donde los vean tus clientes: aquí verás cada escaneo.
        </p>
      ) : null}

      <div className={styles.tiles}>
        <QrTile
          icon={CalendarCheck}
          label="Reservas"
          hint="El QR para reservar mesa desde el móvil."
          count={reservas}
          total={total}
          url={bookingUrl}
          onDownload={company ? () => void downloadBookingQr() : undefined}
          downloading={downloading}
        />
        <QrTile
          icon={BookOpen}
          label="Cartas"
          hint="Descarga el QR de cada carta en «Carta»."
          count={carta}
          total={total}
          url={boardUrl}
          items={boards}
        />
        <QrTile
          icon={Tag}
          label="Promociones"
          hint="Cada promoción tiene su QR en «Promociones»."
          count={promo}
          total={total}
          url={promoUrl}
          items={promos}
        />
      </div>
    </section>
  )
}

export default QrScansPanel
