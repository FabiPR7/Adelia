import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import { searchShowcaseUsers } from '../data/gamificationLeaderboard'
import type { FriendProfile } from '../types/friends'
import ConfirmDialog from './ConfirmDialog'
import FriendActionBar from './FriendActionBar'
import FriendProfileView from './FriendProfileView'
import FriendsStripModal from './FriendsStripModal'
import GamificationRankingStripCard from './GamificationRankingStripCard'
import RankingStripList from './RankingStripList'
import styles from './CustomerFriendsBoard.module.css'

interface CustomerFriendsBoardProps {
  favoriteFriends: FriendProfile[]
  regularFriends: FriendProfile[]
  blockedSearchIds: string[]
  incomingRequests: FriendProfile[]
  incomingRequestCount: number
  userEntry: LeaderboardEntry
  userRankAmongFriends: number
  onSendFriendRequest: (id: string) => boolean
  onAcceptFriendRequest: (id: string) => boolean
  onRejectFriendRequest: (id: string) => boolean
  hasOutgoingRequest: (id: string) => boolean
  onRemoveFriend: (id: string) => void
  onToggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  onFriendProfileActiveChange?: (active: boolean) => void
}

function friendToStripProps(friend: FriendProfile, rank?: number) {
  return {
    level: friend.level,
    levelTitle: friend.levelTitle,
    displayName: friend.displayName,
    photoUrl: friend.photoUrl,
    xp: friend.xp,
    rank,
    levelProgress: friend.levelProgress,
  }
}

function profileToStripProps(friend: FriendProfile) {
  return friendToStripProps(friend)
}

function searchAmongFriends(friends: FriendProfile[], query: string): FriendProfile[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return []
  }

  return friends.filter((friend) => friend.displayName.toLowerCase().includes(normalized))
}

function CustomerFriendsBoard({
  favoriteFriends,
  regularFriends,
  blockedSearchIds,
  incomingRequests,
  incomingRequestCount,
  userEntry,
  userRankAmongFriends,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  hasOutgoingRequest,
  onRemoveFriend,
  onToggleFavorite,
  isFavorite,
  onFriendProfileActiveChange,
}: CustomerFriendsBoardProps) {
  const [friendQuery, setFriendQuery] = useState('')
  const [friendSubmittedQuery, setFriendSubmittedQuery] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addSubmittedQuery, setAddSubmittedQuery] = useState('')
  const [requestsModalOpen, setRequestsModalOpen] = useState(false)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null)
  const [acceptingFriendId, setAcceptingFriendId] = useState<string | null>(null)
  const [rejectConfirmFriend, setRejectConfirmFriend] = useState<FriendProfile | null>(null)
  const acceptTimeoutRef = useRef<number | null>(null)
  const entryAnchorsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    return () => {
      if (acceptTimeoutRef.current != null) {
        window.clearTimeout(acceptTimeoutRef.current)
      }
    }
  }, [])

  const handleAcceptRequest = (friendId: string) => {
    if (acceptingFriendId) {
      return
    }

    setAcceptingFriendId(friendId)
    acceptTimeoutRef.current = window.setTimeout(() => {
      onAcceptFriendRequest(friendId)
      setAcceptingFriendId(null)
      acceptTimeoutRef.current = null
    }, 1000)
  }

  const addSearchResults = useMemo(
    () => searchShowcaseUsers(addSubmittedQuery, blockedSearchIds),
    [addSubmittedQuery, blockedSearchIds],
  )

  const handleAddSearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = addQuery.trim()
    if (!trimmed) {
      return
    }
    setAddSubmittedQuery(trimmed)
  }

  const handleFriendSearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = friendQuery.trim()
    if (!trimmed) {
      return
    }
    setFriendSubmittedQuery(trimmed)
  }

  const allFriends = useMemo(
    () => [...favoriteFriends, ...regularFriends],
    [favoriteFriends, regularFriends],
  )

  const friendSearchResults = useMemo(
    () => searchAmongFriends(allFriends, friendSubmittedQuery),
    [allFriends, friendSubmittedQuery],
  )

  const selectedFriend = useMemo(
    () => allFriends.find((friend) => friend.id === selectedFriendId) ?? null,
    [allFriends, selectedFriendId],
  )

  const friendsRankingEntries = useMemo((): LeaderboardEntry[] => {
    const peerEntries: LeaderboardEntry[] = allFriends.map((friend) => ({
      id: friend.id,
      rank: 0,
      displayName: friend.displayName,
      xp: friend.xp,
      level: friend.level,
      levelTitle: friend.levelTitle,
      styleClass: `level${friend.level}`,
      levelProgress: friend.levelProgress,
      missionsCompleted: friend.missionsCompleted,
      streak: friend.streak,
      photoUrl: friend.photoUrl,
      homeCountry: friend.homeCountry,
      homeCity: friend.homeCity,
      reservationsTotal: friend.reservationsTotal,
      foodPreferences: friend.foodPreferences,
      badgeIds: friend.badgeIds,
      isYou: false,
    }))

    const merged = [...peerEntries, { ...userEntry, isYou: true }]
      .sort((left, right) => right.xp - left.xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))

    return merged
  }, [allFriends, userEntry])

  const userRankInList = friendsRankingEntries.find((entry) => entry.isYou)?.rank ?? userRankAmongFriends

  const registerEntryAnchor = useCallback((entryKey: string, node: HTMLDivElement | null) => {
    if (node) {
      entryAnchorsRef.current.set(entryKey, node)
      return
    }
    entryAnchorsRef.current.delete(entryKey)
  }, [])

  const scrollToFriend = (friendId: string) => {
    entryAnchorsRef.current.get(friendId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setActiveFriendId(friendId)
    setFriendSubmittedQuery('')
    setFriendQuery('')
  }

  const handleFriendEntryClick = (entry: LeaderboardEntry) => {
    if (!entry.id || entry.isYou) {
      return
    }
    setActiveFriendId((current) => (current === entry.id ? null : entry.id ?? null))
  }

  const renderFriendActions = (entry: LeaderboardEntry) => {
    if (!entry.id) {
      return null
    }

    return (
      <FriendActionBar
        displayName={entry.displayName}
        isFavorite={isFavorite(entry.id)}
        onProfile={() => setSelectedFriendId(entry.id!)}
        onToggleFavorite={() => onToggleFavorite(entry.id!)}
        onRemove={() => {
          onRemoveFriend(entry.id!)
          setActiveFriendId(null)
        }}
      />
    )
  }

  useEffect(() => {
    onFriendProfileActiveChange?.(selectedFriendId != null)
  }, [selectedFriendId, onFriendProfileActiveChange])

  if (selectedFriend) {
    return (
      <FriendProfileView
        friend={selectedFriend}
        onBack={() => setSelectedFriendId(null)}
      />
    )
  }

  const headerActions = (
    <>
      <button
        type="button"
        className={styles.headIconBtn}
        onClick={() => setRequestsModalOpen(true)}
        aria-label={`Solicitudes de amistad${incomingRequestCount > 0 ? `, ${incomingRequestCount} pendientes` : ''}`}
      >
        <span className={styles.headIconGlyph} aria-hidden="true">🔔</span>
        {incomingRequestCount > 0 ? (
          <span className={styles.headIconBadge}>{incomingRequestCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={styles.headIconBtn}
        onClick={() => {
          setAddModalOpen(true)
          setAddQuery('')
          setAddSubmittedQuery('')
        }}
        aria-label="Añadir amigos"
      >
        <span className={styles.headIconGlyph} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.addFriendSvg}>
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            <path d="M19 11h-2V9h-2v2h-2v2h2v2h2v-2h2z" />
          </svg>
        </span>
      </button>
    </>
  )

  const friendSearchToolbar = (
    <div className={styles.friendSearchBlock}>
      <form className={styles.friendSearchForm} onSubmit={handleFriendSearch}>
        <input
          type="search"
          value={friendQuery}
          onChange={(event) => setFriendQuery(event.target.value)}
          placeholder="Buscar entre tus amigos…"
          className={styles.friendSearchInput}
          aria-label="Buscar entre tus amigos"
        />
        <button type="submit" className={styles.friendSearchBtn} disabled={!friendQuery.trim()}>
          Buscar
        </button>
      </form>

      {friendSubmittedQuery.length > 0 && friendSearchResults.length > 0 && (
        <div className={styles.friendSearchResults}>
          {friendSearchResults.map((friend) => {
            const rank = friendsRankingEntries.find((entry) => entry.id === friend.id)?.rank ?? 0
            return (
              <button
                key={friend.id}
                type="button"
                className={styles.friendSearchHit}
                onClick={() => scrollToFriend(friend.id)}
              >
                <strong>{friend.displayName}</strong>
                <span>#{rank} · {friend.xp.toLocaleString('es-ES')} XP</span>
              </button>
            )
          })}
        </div>
      )}

      {friendSubmittedQuery.length > 0 && friendSearchResults.length === 0 && (
        <p className={styles.emptyHint}>Ningún amigo coincide con «{friendSubmittedQuery}».</p>
      )}
    </div>
  )

  return (
    <div className={styles.board}>
      <RankingStripList
        entries={friendsRankingEntries}
        userRank={userRankInList}
        sectionTitle="Clasificación entre amigos"
        sectionActions={headerActions}
        toolbar={friendSearchToolbar}
        showChaseCopy={false}
        onEntryAnchorRef={registerEntryAnchor}
        activeEntryKey={activeFriendId}
        onFriendEntryClick={handleFriendEntryClick}
        isEntryFavorite={(entry) => Boolean(entry.id && isFavorite(entry.id))}
        renderEntryActions={renderFriendActions}
      />

      {addModalOpen && (
        <FriendsStripModal
          variant="add"
          title="Añadir amigos"
          subtitle="Encuentra foodies y mándales una solicitud"
          onClose={() => setAddModalOpen(false)}
          isEmpty={addSubmittedQuery.length > 0 && addSearchResults.length === 0}
          emptyMessage={
            addSubmittedQuery
              ? `Nadie coincide con «${addSubmittedQuery}»`
              : 'Sin resultados'
          }
          emptyHint="Prueba con otro nombre o revisa la ortografía."
        >
          <div className={styles.modalSearchPanel}>
            <form className={styles.modalSearchForm} onSubmit={handleAddSearch}>
              <span className={styles.modalSearchIcon} aria-hidden="true">🔎</span>
              <input
                type="search"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder="Buscar por nombre…"
                className={styles.modalSearchInput}
              />
              <button type="submit" className={styles.modalSearchBtn} disabled={!addQuery.trim()}>
                Buscar
              </button>
            </form>
            <p className={styles.modalSearchHint}>
              {addSubmittedQuery
                ? `${addSearchResults.length} resultado${addSearchResults.length === 1 ? '' : 's'}`
                : 'Escribe un nombre y envía tu solicitud de amistad'}
            </p>
          </div>

          {addSubmittedQuery.length > 0 && addSearchResults.length > 0 && (
            <div className={styles.modalList}>
              {addSearchResults.map((entry) => {
                const sent = entry.id ? hasOutgoingRequest(entry.id) : false
                return (
                  <article key={entry.id} className={styles.addCard}>
                    <div className={styles.addCardStrip}>
                      <GamificationRankingStripCard
                        level={entry.level}
                        levelTitle={entry.levelTitle}
                        displayName={entry.displayName}
                        photoUrl={entry.photoUrl}
                        xp={entry.xp}
                        levelProgress={entry.levelProgress}
                      />
                    </div>
                    <button
                      type="button"
                      className={`${styles.addCardBtn} ${sent ? styles.addCardBtnSent : ''}`}
                      title={sent ? 'Solicitud enviada' : 'Enviar solicitud de amistad'}
                      disabled={sent}
                      onClick={() => {
                        if (entry.id) {
                          onSendFriendRequest(entry.id)
                        }
                      }}
                    >
                      <span className={styles.addCardBtnIcon} aria-hidden="true">
                        {sent ? '✓' : '+'}
                      </span>
                      <span>{sent ? 'Enviada' : 'Solicitar'}</span>
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </FriendsStripModal>
      )}

      {requestsModalOpen && (
        <FriendsStripModal
          variant="notifications"
          title="Solicitudes"
          subtitle="Usuarios que quieren conectar contigo"
          badgeCount={incomingRequestCount}
          onClose={() => setRequestsModalOpen(false)}
          isEmpty={incomingRequests.length === 0}
          emptyMessage="No tienes solicitudes pendientes"
          emptyHint="Cuando alguien te invite, aparecerá aquí para que aceptes o rechaces."
        >
          <div className={styles.modalList}>
            {incomingRequests.map((friend) => {
              const isAccepting = acceptingFriendId === friend.id
              const rowBusy = acceptingFriendId != null

              return (
                <article key={friend.id} className={styles.requestCard}>
                  <p className={styles.requestCardEyebrow}>Quiere ser tu amigo</p>
                  <div className={styles.requestCardRow}>
                    <div className={styles.requestCardStrip}>
                      <GamificationRankingStripCard {...profileToStripProps(friend)} />
                    </div>
                    <div className={styles.decisionGroup} role="group" aria-label={`Responder a ${friend.displayName}`}>
                      <button
                        type="button"
                        className={`${styles.decisionBtn} ${styles.decisionReject}`}
                        title="Rechazar"
                        aria-label="Rechazar solicitud"
                        disabled={rowBusy}
                        onClick={() => setRejectConfirmFriend(friend)}
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        className={`${styles.decisionBtn} ${styles.decisionAccept} ${isAccepting ? styles.decisionLoading : ''}`}
                        title="Aceptar"
                        aria-label={isAccepting ? 'Aceptando solicitud' : 'Aceptar solicitud'}
                        aria-busy={isAccepting}
                        disabled={rowBusy}
                        onClick={() => handleAcceptRequest(friend.id)}
                      >
                        {isAccepting ? '…' : '✓'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </FriendsStripModal>
      )}

      <ConfirmDialog
        elevated
        isOpen={rejectConfirmFriend != null}
        title="¿Estás seguro?"
        message={
          rejectConfirmFriend
            ? `Vas a rechazar la solicitud de ${rejectConfirmFriend.displayName}.`
            : ''
        }
        confirmLabel="Sí, rechazar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (rejectConfirmFriend) {
            onRejectFriendRequest(rejectConfirmFriend.id)
          }
          setRejectConfirmFriend(null)
        }}
        onCancel={() => setRejectConfirmFriend(null)}
      />
    </div>
  )
}

export default CustomerFriendsBoard
