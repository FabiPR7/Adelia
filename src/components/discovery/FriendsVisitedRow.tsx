import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { fetchFriendsVisits, type FriendVisitedRestaurant } from '../../services/customerFriends'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './FriendsVisitedRow.module.css'

function friendsLine(item: FriendVisitedRestaurant): string {
  const first = item.friends[0]?.name.split(' ')[0] ?? 'Un amigo'
  const others = item.friendCount - 1
  if (others <= 0) return `${first} ha estado aquí`
  if (others === 1) return `${first} y 1 amigo más han estado`
  return `${first} y ${others} amigos más han estado`
}

/** «Tus amigos han ido»: locales donde han estado tus amigos de Adelia. */
function FriendsVisitedRow() {
  const [items, setItems] = useState<FriendVisitedRestaurant[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFriendsVisits()
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!items || items.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="friends-visited-title">
      <div className={styles.heading}>
        <span className={styles.kicker}><Users size={14} aria-hidden="true" /> De tu gente</span>
        <h2 id="friends-visited-title">Tus amigos han ido</h2>
      </div>
      <ul className={styles.row}>
        {items.map((item) => {
          const photo = item.photoUrl ? optimizeCloudinaryUrl(item.photoUrl, CLOUDINARY_DISPLAY.photoPreview) : ''
          return (
            <li key={item.companyId}>
              <Link to={`/reservar/${item.slug}`} className={styles.card}>
                <span className={styles.media}>
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className={styles.fallback} aria-hidden="true">{item.name.charAt(0)}</span>
                  )}
                </span>
                <span className={styles.body}>
                  <strong className={styles.name}>{item.name}</strong>
                  {item.municipality ? <span className={styles.place}>{item.municipality}</span> : null}
                  <span className={styles.friends}>
                    <span className={styles.avatars} aria-hidden="true">
                      {item.friends.slice(0, 3).map((friend) =>
                        friend.photoUrl ? (
                          <img key={friend.id} src={friend.photoUrl} alt="" className={styles.avatar} loading="lazy" />
                        ) : (
                          <span key={friend.id} className={styles.avatar}>{friend.name.charAt(0).toUpperCase()}</span>
                        ),
                      )}
                    </span>
                    <span className={styles.friendsText}>{friendsLine(item)}</span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default FriendsVisitedRow
