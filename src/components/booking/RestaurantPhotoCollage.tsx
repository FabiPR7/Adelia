import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  CLOUDINARY_DISPLAY,
  cloudinaryVideoPosterUrl,
  ensureHttpsUrl,
  optimizeCloudinaryUrl,
  optimizeCloudinaryVideoUrl,
} from '../../utils/cloudinaryUrl'
import { buildCollageSlots, type CollageItem } from '../../utils/restaurantCollage'
import styles from './RestaurantPhotoCollage.module.css'

const COLLAGE_MAX_VISIBLE = 5
const LEFTOVER_ROTATE_MS = 3500

interface RestaurantPhotoCollageProps {
  photos: string[]
  videos?: string[]
  mainPhotoIndex?: number
  fallbackLabel: string
  restaurantName: string
}

function collageLayoutClass(count: number, hasVideo: boolean): string {
  if (hasVideo) {
    if (count <= 1) {
      return styles.collageOne
    }

    if (count === 2) {
      return styles.collageTwoFeatured
    }

    if (count === 3) {
      return styles.collageThree
    }

    if (count === 4) {
      return styles.collageFourFeatured
    }

    return styles.collageFive
  }

  if (count <= 1) {
    return styles.collageOne
  }

  if (count === 2) {
    return styles.collageTwo
  }

  if (count === 3) {
    return styles.collageThree
  }

  if (count === 4) {
    return styles.collageFour
  }

  return styles.collageFive
}

function PlayMark() {
  return (
    <span className={styles.playMark} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M8.2 5.6v12.8L18.4 12 8.2 5.6z" fill="currentColor" />
      </svg>
    </span>
  )
}

function FeaturedVideo({
  url,
  label,
  loop,
  onEnded,
}: {
  url: string
  label: string
  loop: boolean
  onEnded: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const endedRef = useRef(false)
  const original = ensureHttpsUrl(url)
  const optimized = optimizeCloudinaryVideoUrl(url)
  const [src, setSrc] = useState(optimized)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    setSrc(optimized)
    setNeedsTap(false)
    endedRef.current = false
  }, [optimized, url])

  useEffect(() => {
    const el = videoRef.current
    if (!el) {
      return
    }

    el.muted = true
    if ('defaultMuted' in el) {
      el.defaultMuted = true
    }
    el.playsInline = true
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    const tryPlay = () => {
      try {
        const result = el.play()
        if (result && typeof result.then === 'function') {
          void result.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true))
          return
        }
        setNeedsTap(false)
      } catch {
        setNeedsTap(true)
      }
    }

    tryPlay()
    el.addEventListener('loadeddata', tryPlay, { once: true })
    return () => el.removeEventListener('loadeddata', tryPlay)
  }, [src])

  const finish = () => {
    if (loop || endedRef.current) {
      return
    }

    endedRef.current = true
    onEnded()
  }

  return (
    <div className={`${styles.tile} ${styles.tileVideo}`}>
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        poster={cloudinaryVideoPosterUrl(url) || undefined}
        controls
        playsInline
        muted
        autoPlay
        loop={loop}
        preload="auto"
        controlsList="nodownload"
        aria-label={`Vídeo de ${label}`}
        onEnded={finish}
        onTimeUpdate={(event) => {
          if (loop) {
            return
          }

          const media = event.currentTarget
          if (media.duration > 0 && media.currentTime >= media.duration - 0.25) {
            finish()
          }
        }}
        onError={() => {
          if (src !== original) {
            setSrc(original)
          }
        }}
      />
      {needsTap ? (
        <button
          type="button"
          className={styles.playOverlay}
          onClick={() => {
            void videoRef.current?.play()
              .then(() => setNeedsTap(false))
              .catch(() => setNeedsTap(true))
          }}
          aria-label="Reproducir vídeo"
        >
          <PlayMark />
        </button>
      ) : null}
    </div>
  )
}

function PhotoLightbox({
  photos,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  photos: string[]
  index: number
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}) {
  const touchStartX = useRef<number | null>(null)
  const photo = photos[index]
  const hasMany = photos.length > 1

  const goBy = useCallback((delta: number) => {
    onIndexChange((index + delta + photos.length) % photos.length)
  }, [index, onIndexChange, photos.length])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowRight') {
        goBy(1)
      }

      if (event.key === 'ArrowLeft') {
        goBy(-1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goBy, onClose])

  if (!photo) {
    return null
  }

  return createPortal(
    <div
      className={styles.lightbox}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${title}`}
      onTouchStart={(event: TouchEvent<HTMLDivElement>) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event: TouchEvent<HTMLDivElement>) => {
        if (touchStartX.current == null) {
          return
        }

        const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current
        touchStartX.current = null

        if (Math.abs(delta) < 40) {
          return
        }

        goBy(delta < 0 ? 1 : -1)
      }}
    >
      <div className={styles.lightboxPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.lightboxBar}>
          <p className={styles.lightboxTitle}>
            {title}
            {hasMany ? ` · ${index + 1}/${photos.length}` : ''}
          </p>
          <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <img
          src={optimizeCloudinaryUrl(photo, CLOUDINARY_DISPLAY.photoGallery)}
          alt={`${title}, foto ${index + 1}`}
          className={styles.lightboxImage}
        />
        {hasMany ? (
          <>
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
              onClick={() => goBy(-1)}
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNext}`}
              onClick={() => goBy(1)}
              aria-label="Foto siguiente"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

function MediaThumb({
  item,
  onOpenPhoto,
  onOpenVideo,
  showMoreCount = 0,
}: {
  item: CollageItem
  onOpenPhoto: (url: string) => void
  onOpenVideo: (url: string) => void
  showMoreCount?: number
}) {
  const poster = item.type === 'video' ? cloudinaryVideoPosterUrl(item.url, 480) : ''

  return (
    <button
      type="button"
      className={styles.tile}
      onClick={() => {
        if (item.type === 'video') {
          onOpenVideo(item.url)
          return
        }
        onOpenPhoto(item.url)
      }}
      aria-label={item.type === 'video' ? 'Ver este vídeo en grande' : 'Ver foto'}
    >
      {item.type === 'video' ? (
        poster ? (
          <img src={poster} alt="" className={styles.image} />
        ) : (
          <span className={styles.videoFallback} />
        )
      ) : (
        <img
          src={optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)}
          alt=""
          className={styles.image}
          loading="lazy"
          decoding="async"
        />
      )}
      {item.type === 'video' ? <PlayMark /> : null}
      {showMoreCount > 0 ? (
        <span className={styles.more} aria-hidden="true">
          +{showMoreCount}
        </span>
      ) : null}
    </button>
  )
}

const NO_VIDEOS: string[] = []

export default function RestaurantPhotoCollage({
  photos,
  videos = NO_VIDEOS,
  mainPhotoIndex = 0,
  fallbackLabel,
  restaurantName,
}: RestaurantPhotoCollageProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [featuredVideoIndex, setFeaturedVideoIndex] = useState(0)
  const [leftoverIndex, setLeftoverIndex] = useState(0)

  const slots = useMemo(
    () => buildCollageSlots(photos, videos, mainPhotoIndex, featuredVideoIndex),
    [photos, videos, mainPhotoIndex, featuredVideoIndex],
  )
  const clips = videos.filter(Boolean).slice(0, 2)

  useEffect(() => {
    setFeaturedVideoIndex(0)
    setLeftoverIndex(0)
  }, [photos, videos])

  useEffect(() => {
    if (slots.leftovers.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setLeftoverIndex((current) => (current + 1) % slots.leftovers.length)
    }, LEFTOVER_ROTATE_MS)

    return () => window.clearInterval(timer)
  }, [slots.leftovers.length, featuredVideoIndex])

  const openPhoto = (url: string) => {
    const index = slots.orderedPhotos.indexOf(url)
    setLightboxIndex(index >= 0 ? index : 0)
  }

  const openVideo = (url: string) => {
    const index = clips.indexOf(url)
    if (index >= 0) {
      setFeaturedVideoIndex(index)
    }
  }

  if (slots.tileCount === 0) {
    return (
      <div className={`${styles.collage} ${styles.collageOne}`} aria-label="Galería del restaurante">
        <div className={styles.fallback}>{fallbackLabel.charAt(0).toUpperCase()}</div>
      </div>
    )
  }

  const leftover = slots.leftovers[leftoverIndex % Math.max(slots.leftovers.length, 1)]

  return (
    <>
      <div
        className={`${styles.collage} ${collageLayoutClass(slots.tileCount, Boolean(slots.featuredVideo))}`}
        aria-label="Galería del restaurante"
      >
        {slots.featuredVideo ? (
          <FeaturedVideo
            key={slots.featuredVideo}
            url={slots.featuredVideo}
            label={restaurantName}
            loop={clips.length <= 1}
            onEnded={() => {
              if (clips.length > 1) {
                setFeaturedVideoIndex((current) => (current + 1) % clips.length)
              }
            }}
          />
        ) : null}

        {(slots.featuredVideo ? slots.staticSmall : slots.staticSmall.slice(0, COLLAGE_MAX_VISIBLE)).map((item, index) => {
          const photoOnlyLast = !slots.featuredVideo
            && index === slots.staticSmall.length - 1
            && slots.leftovers.length > 0

          return (
            <MediaThumb
              key={`${item.type}-${item.url}-${index}`}
              item={item}
              onOpenPhoto={openPhoto}
              onOpenVideo={openVideo}
              showMoreCount={photoOnlyLast ? slots.leftovers.length : 0}
            />
          )
        })}

        {slots.featuredVideo && leftover ? (
          <MediaThumb
            key={`leftover-${leftover.url}-${leftoverIndex}`}
            item={leftover}
            onOpenPhoto={openPhoto}
            onOpenVideo={openVideo}
          />
        ) : null}
      </div>
      {lightboxIndex != null ? (
        <PhotoLightbox
          photos={slots.orderedPhotos}
          index={lightboxIndex}
          title={restaurantName}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  )
}
