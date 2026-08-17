import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import { searchCustomers } from '../services/customerFriends'
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
  onSendFriendRequest: (id: string) => Promise<void> | boolean
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

type PersonRelation = 'friend' | 'outgoing' | 'incoming' | 'none'

function CustomerFriendsBoard({
  favoriteFriends,
  regularFriends,
  blockedSearchIds: _blockedSearchIds,
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
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleResults, setPeopleResults] = useState<FriendProfile[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [peopleError, setPeopleError] = useState<string | null>(null)
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

  const [addSearchResults, setAddSearchResults] = useState<FriendProfile[]>([])
  const [addSearchLoading, setAddSearchLoading] = useState(false)
  const [addSearchError, setAddSearchError] = useState<string | null>(null)
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null)
  const [requestErrorById, setRequestErrorById] = useState<Record<string, string>>({})

  const openAddModal = (presetQuery = '') => {
    setAddModalOpen(true)
    setAddQuery(presetQuery)
    setAddSubmittedQuery(presetQuery.trim())
    setAddSearchError(null)
    setRequestErrorById({})
  }

  useEffect(() => {
    const trimmed = addSubmittedQuery.trim()
    if (trimmed.length < 2) {
      setAddSearchResults([])
      setAddSearchLoading(false)
      setAddSearchError(null)
      return
    }

    let cancelled = false
    setAddSearchLoading(true)
    setAddSearchError(null)

    void searchCustomers(trimmed)
      .then((results) => {
        if (!cancelled) {
          setAddSearchResults(results)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAddSearchResults([])
          setAddSearchError(error instanceof Error ? error.message : 'No se pudo buscar.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddSearchLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addSubmittedQuery])

  useEffect(() => {
    if (!addModalOpen) {
      return
    }
    const trimmed = addQuery.trim()
    const timer = window.setTimeout(() => {
      setAddSubmittedQuery(trimmed)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [addQuery, addModalOpen])

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
    setPeopleQuery(friendQuery.trim())
  }

  useEffect(() => {
    const trimmed = friendQuery.trim()
    const timer = window.setTimeout(() => {
      setPeopleQuery(trimmed)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [friendQuery])

  useEffect(() => {
    const trimmed = peopleQuery.trim()
    if (trimmed.length < 2) {
      setPeopleResults([])
      setPeopleLoading(false)
      setPeopleError(null)
      return
    }

    let cancelled = false
    setPeopleLoading(true)
    setPeopleError(null)

    void searchCustomers(trimmed)
      .then((results) => {
        if (!cancelled) {
          setPeopleResults(results)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPeopleResults([])
          setPeopleError(error instanceof Error ? error.message : 'No se pudo buscar.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPeopleLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [peopleQuery])

  const allFriends = useMemo(
    () => [...favoriteFriends, ...regularFriends],
    [favoriteFriends, regularFriends],
  )

  const friendIds = useMemo(
    () => new Set(allFriends.map((friend) => friend.id)),
    [allFriends],
  )
  const incomingIds = useMemo(
    () => new Set(incomingRequests.map((friend) => friend.id)),
    [incomingRequests],
  )

  const relationOf = (id: string): PersonRelation => {
    if (friendIds.has(id)) {
      return 'friend'
    }
    if (incomingIds.has(id)) {
      return 'incoming'
    }
    if (hasOutgoingRequest(id)) {
      return 'outgoing'
    }
    return 'none'
  }

  const sendRequestTo = (id: string) => {
    setSendingRequestId(id)
    setRequestErrorById((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    void Promise.resolve(onSendFriendRequest(id))
      .catch((error) => {
        setRequestErrorById((current) => ({
          ...current,
          [id]: error instanceof Error ? error.message : 'No se pudo enviar.',
        }))
      })
      .finally(() => setSendingRequestId(null))
  }

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
    setPeopleQuery('')
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
        onClick={() => openAddModal()}
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
          placeholder="Nombre o email de cualquier usuario…"
          className={styles.friendSearchInput}
          aria-label="Buscar personas en Adelia"
        />
        <button type="submit" className={styles.friendSearchBtn} disabled={friendQuery.trim().length < 2}>
          Buscar
        </button>
      </form>
      <p className={styles.peopleSearchHint}>
        {peopleLoading
          ? 'Buscando cuentas reales…'
          : peopleError
            ? peopleError
            : peopleQuery.trim().length >= 2
              ? `${peopleResults.length} resultado${peopleResults.length === 1 ? '' : 's'} en Adelia`
              : 'Escribe al menos 2 letras: Stan, Georgiana, el nombre completo o el email.'}
      </p>

      {peopleQuery.trim().length >= 2 && !peopleLoading && !peopleError && peopleResults.length === 0 ? (
        <p className={styles.emptyHint}>
          Nadie coincide con «{peopleQuery}». Prueba otra parte del nombre o el email.
        </p>
      ) : null}

      {peopleResults.length > 0 && (
        <div className={styles.friendSearchResults}>
          {peopleResults.map((person) => {
            const relation = relationOf(person.id)
            const rank = friendsRankingEntries.find((entry) => entry.id === person.id)?.rank ?? 0
            const sending = sendingRequestId === person.id
            const requestError = requestErrorById[person.id]
            const sent = relation === 'outgoing' || hasOutgoingRequest(person.id)

            if (relation === 'friend') {
              return (
                <button
                  key={person.id}
                  type="button"
                  className={styles.friendSearchHit}
                  onClick={() => scrollToFriend(person.id)}
                >
                  <strong>{person.displayName}</strong>
                  <span>Ya sois amigos · #{rank}</span>
                </button>
              )
            }

            return (
              <div key={person.id} className={styles.peopleHit}>
                <div className={styles.peopleHitCopy}>
                  <strong>{person.displayName}</strong>
                  <span>
                    {relation === 'incoming'
                      ? 'Te envió una solicitud'
                      : sent
                        ? 'Solicitud enviada'
                        : 'Usuario de Adelia'}
                  </span>
                  {requestError ? <span className={styles.peopleHitError}>{requestError}</span> : null}
                </div>
                {relation === 'incoming' ? (
                  <button
                    type="button"
                    className={styles.peopleHitBtn}
                    onClick={() => setRequestsModalOpen(true)}
                  >
                    Ver
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.peopleHitBtn} ${sent ? styles.peopleHitBtnSent : ''}`}
                    disabled={sent || sending}
                    onClick={() => sendRequestTo(person.id)}
                  >
                    {sent ? 'Enviada' : sending ? '…' : 'Solicitar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
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
        >
          <div className={styles.modalSearchPanel}>
            <form className={styles.modalSearchForm} onSubmit={handleAddSearch}>
              <span className={styles.modalSearchIcon} aria-hidden="true">🔎</span>
              <input
                type="search"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder="Nombre o email…"
                className={styles.modalSearchInput}
              />
              <button type="submit" className={styles.modalSearchBtn} disabled={!addQuery.trim()}>
                Buscar
              </button>
            </form>
            <p className={styles.modalSearchHint}>
              {addSearchLoading
                ? 'Buscando cuentas reales de Adelia…'
                : addSearchError
                  ? addSearchError
                  : addSubmittedQuery.length >= 2
                    ? `${addSearchResults.length} resultado${addSearchResults.length === 1 ? '' : 's'}`
                    : 'Escribe al menos 2 letras. Cualquier cuenta de cliente puede aparecer.'}
            </p>
            {addSubmittedQuery.length >= 2 && !addSearchLoading && !addSearchError && addSearchResults.length === 0 ? (
              <p className={styles.emptyHint}>
                Nadie coincide con «{addSubmittedQuery}». Prueba nombre, apellido o el email.
              </p>
            ) : null}
          </div>

          {addSubmittedQuery.length > 0 && addSearchResults.length > 0 && (
            <div className={styles.modalList}>
              {addSearchResults.map((entry) => {
                const relation = relationOf(entry.id)
                const sent = relation === 'outgoing' || hasOutgoingRequest(entry.id)
                const sending = sendingRequestId === entry.id
                const requestError = entry.id ? requestErrorById[entry.id] : null
                const alreadyFriends = relation === 'friend'
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
                      className={`${styles.addCardBtn} ${sent || alreadyFriends ? styles.addCardBtnSent : ''}`}
                      title={
                        alreadyFriends
                          ? 'Ya sois amigos'
                          : relation === 'incoming'
                            ? 'Te envió una solicitud'
                            : sent
                              ? 'Solicitud enviada'
                              : 'Enviar solicitud de amistad'
                      }
                      disabled={sent || sending || alreadyFriends || relation === 'incoming'}
                      onClick={() => {
                        if (!entry.id || alreadyFriends || relation === 'incoming') {
                          return
                        }
                        sendRequestTo(entry.id)
                      }}
                    >
                      <span className={styles.addCardBtnIcon} aria-hidden="true">
                        {alreadyFriends || sent ? '✓' : '+'}
                      </span>
                      <span>
                        {alreadyFriends
                          ? 'Amigos'
                          : relation === 'incoming'
                            ? 'Pendiente'
                            : sent
                              ? 'Enviada'
                              : sending
                                ? 'Enviando…'
                                : 'Solicitar'}
                      </span>
                    </button>
                    {requestError ? <p className={styles.emptyHint}>{requestError}</p> : null}
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
