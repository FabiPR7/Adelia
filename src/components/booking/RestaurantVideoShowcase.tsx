import { useEffect, useState } from 'react'
import {
  cloudinaryVideoPosterUrl,
  ensureHttpsUrl,
  optimizeCloudinaryVideoUrl,
} from '../../utils/cloudinaryUrl'
import styles from './RestaurantVideoShowcase.module.css'

interface RestaurantVideoShowcaseProps {
  videos: string[]
  restaurantName: string
}

function ClipPlayer({
  url,
  label,
}: {
  url: string
  label: string
}) {
  const original = ensureHttpsUrl(url)
  const optimized = optimizeCloudinaryVideoUrl(url)
  const poster = cloudinaryVideoPosterUrl(url)
  const [src, setSrc] = useState(optimized)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSrc(optimized)
    setFailed(false)
  }, [optimized, url])

  if (failed) {
    return (
      <div className={styles.player}>
        <p className={styles.broken}>No se pudo reproducir este vídeo.</p>
      </div>
    )
  }

  return (
    <div className={styles.player}>
      <video
        className={styles.video}
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        aria-label={`Vídeo de ${label}`}
        onError={() => {
          if (src !== original) {
            setSrc(original)
            return
          }
          setFailed(true)
        }}
      />
    </div>
  )
}

export default function RestaurantVideoShowcase({
  videos,
  restaurantName,
}: RestaurantVideoShowcaseProps) {
  const clips = videos.filter(Boolean).slice(0, 2)
  const [activeIndex, setActiveIndex] = useState(0)

  if (clips.length === 0) {
    return null
  }

  const safeIndex = Math.min(activeIndex, clips.length - 1)
  const activeUrl = clips[safeIndex]

  return (
    <section className={styles.section} aria-label={`Ambiente de ${restaurantName}`}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Ambiente</p>
        {clips.length > 1 ? (
          <p className={styles.count}>{safeIndex + 1}/{clips.length}</p>
        ) : null}
      </div>
      <ClipPlayer
        key={activeUrl}
        url={activeUrl}
        label={restaurantName}
      />
      {clips.length > 1 ? (
        <div className={styles.thumbs} role="tablist" aria-label="Clips del local">
          {clips.map((clipUrl, index) => {
            const selected = index === safeIndex
            const poster = cloudinaryVideoPosterUrl(clipUrl, 480)

            return (
              <button
                key={`${clipUrl}-${index}`}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`${styles.thumb} ${selected ? styles.thumbOn : ''}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver clip ${index + 1}`}
              >
                {poster ? (
                  <img src={poster} alt="" className={styles.thumbImage} />
                ) : (
                  <span className={styles.thumbFallback} />
                )}
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
