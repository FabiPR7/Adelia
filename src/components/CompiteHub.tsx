import { useCallback, useMemo, useState } from 'react'
import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import CustomerFriendsBoard from './CustomerFriendsBoard'
import CustomerRankingsBoard from './CustomerRankingsBoard'
import type { FriendProfile } from '../types/friends'
import styles from './CompiteHub.module.css'

type CompiteZone = 'friends' | 'rankings'

interface CompiteHubProps {
  userEntry: LeaderboardEntry
  countryEntries: LeaderboardEntry[]
  worldEntries: LeaderboardEntry[]
  countryRank: number
  worldRank: number
  userCountry: string
  userRankAmongFriends: number
  favoriteFriends: FriendProfile[]
  regularFriends: FriendProfile[]
  blockedSearchIds: string[]
  incomingRequests: FriendProfile[]
  incomingRequestCount: number
  onSendFriendRequest: (id: string) => boolean
  onAcceptFriendRequest: (id: string) => boolean
  onRejectFriendRequest: (id: string) => boolean
  hasOutgoingRequest: (id: string) => boolean
  onRemoveFriend: (id: string) => void
  onToggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  onFriendProfileActiveChange?: (active: boolean) => void
}

function CompiteHub({
  userEntry,
  countryEntries,
  worldEntries,
  countryRank,
  worldRank,
  userCountry,
  userRankAmongFriends,
  favoriteFriends,
  regularFriends,
  blockedSearchIds,
  incomingRequests,
  incomingRequestCount,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  hasOutgoingRequest,
  onRemoveFriend,
  onToggleFavorite,
  isFavorite,
  onFriendProfileActiveChange,
}: CompiteHubProps) {
  const [zone, setZone] = useState<CompiteZone>('friends')
  const [friendProfileActive, setFriendProfileActive] = useState(false)

  const handleFriendProfileActiveChange = useCallback(
    (active: boolean) => {
      setFriendProfileActive(active)
      onFriendProfileActiveChange?.(active)
    },
    [onFriendProfileActiveChange],
  )

  const zoneRankLabel = useMemo(() => {
    if (zone === 'friends') {
      return `#${userRankAmongFriends}`
    }
    return `#${countryRank} · 🌍 #${worldRank}`
  }, [zone, userRankAmongFriends, countryRank, worldRank])

  return (
    <div className={styles.hub}>
      {!friendProfileActive && (
        <div className={styles.zoneTabs} role="tablist" aria-label="Zonas de Compite">
          <button
            type="button"
            role="tab"
            aria-selected={zone === 'friends'}
            className={zone === 'friends' ? styles.zoneTabActive : styles.zoneTab}
            onClick={() => setZone('friends')}
          >
            Amigos
            <span>
              {incomingRequestCount > 0 ? `${incomingRequestCount} sol.` : `${favoriteFriends.length} fav`}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={zone === 'rankings'}
            className={zone === 'rankings' ? styles.zoneTabActive : styles.zoneTab}
            onClick={() => setZone('rankings')}
          >
            Rankings
            <span>{zoneRankLabel}</span>
          </button>
        </div>
      )}

      {zone === 'friends' ? (
        <CustomerFriendsBoard
          favoriteFriends={favoriteFriends}
          regularFriends={regularFriends}
          blockedSearchIds={blockedSearchIds}
          incomingRequests={incomingRequests}
          incomingRequestCount={incomingRequestCount}
          userEntry={userEntry}
          userRankAmongFriends={userRankAmongFriends}
          onSendFriendRequest={onSendFriendRequest}
          onAcceptFriendRequest={onAcceptFriendRequest}
          onRejectFriendRequest={onRejectFriendRequest}
          hasOutgoingRequest={hasOutgoingRequest}
          onRemoveFriend={onRemoveFriend}
          onToggleFavorite={onToggleFavorite}
          isFavorite={isFavorite}
          onFriendProfileActiveChange={handleFriendProfileActiveChange}
        />
      ) : (
        <CustomerRankingsBoard
          countryEntries={countryEntries}
          worldEntries={worldEntries}
          countryRank={countryRank}
          worldRank={worldRank}
          userCountry={userCountry}
        />
      )}
    </div>
  )
}

export default CompiteHub
