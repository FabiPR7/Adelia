import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getShowcaseProfileById,
  leaderboardEntryToFriendProfile,
  WEEKLY_LEADERBOARD,
} from '../data/gamificationLeaderboard'
import type { FriendProfile } from '../types/friends'

/** Demo: amigos de Carolina (tú) — uno por nivel para previsualizar fondos. */
const DEFAULT_FRIEND_IDS = [
  'marta-l',
  'carlos-a',
  'elena-v',
  'diego-p',
  'sofia-m',
  'marcos-r',
  'laura-g',
  'pablo-n',
  'irene-s',
  'hugo-t',
  'clara-d',
  'raul-m',
]
const DEFAULT_INCOMING_REQUEST_IDS: string[] = []
const DEFAULT_FAVORITE_IDS = ['clara-d']

function storageKey(userId: string): string {
  return `adelia-friends-v3-${userId}`
}

function readStored(userId: string): {
  friendIds: string[]
  favoriteIds: string[]
  incomingRequestIds: string[]
  outgoingRequestIds: string[]
} {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      return {
        friendIds: DEFAULT_FRIEND_IDS,
        favoriteIds: DEFAULT_FAVORITE_IDS,
        incomingRequestIds: DEFAULT_INCOMING_REQUEST_IDS,
        outgoingRequestIds: [],
      }
    }
    const parsed = JSON.parse(raw) as {
      friendIds?: string[]
      favoriteIds?: string[]
      incomingRequestIds?: string[]
      outgoingRequestIds?: string[]
    }
    return {
      friendIds: parsed.friendIds ?? DEFAULT_FRIEND_IDS,
      favoriteIds: parsed.favoriteIds ?? [],
      incomingRequestIds: parsed.incomingRequestIds ?? DEFAULT_INCOMING_REQUEST_IDS,
      outgoingRequestIds: parsed.outgoingRequestIds ?? [],
    }
  } catch {
    return {
      friendIds: DEFAULT_FRIEND_IDS,
      favoriteIds: DEFAULT_FAVORITE_IDS,
      incomingRequestIds: DEFAULT_INCOMING_REQUEST_IDS,
      outgoingRequestIds: [],
    }
  }
}

function writeStored(
  userId: string,
  state: {
    friendIds: string[]
    favoriteIds: string[]
    incomingRequestIds: string[]
    outgoingRequestIds: string[]
  },
): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(state))
}

export function useCustomerFriends(userId: string | undefined) {
  const [friendIds, setFriendIds] = useState<string[]>(DEFAULT_FRIEND_IDS)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(DEFAULT_FAVORITE_IDS)
  const [incomingRequestIds, setIncomingRequestIds] = useState<string[]>(DEFAULT_INCOMING_REQUEST_IDS)
  const [outgoingRequestIds, setOutgoingRequestIds] = useState<string[]>([])

  useEffect(() => {
    if (!userId) {
      return
    }
    const stored = readStored(userId)
    setFriendIds(stored.friendIds)
    setFavoriteIds(stored.favoriteIds)
    setIncomingRequestIds(stored.incomingRequestIds)
    setOutgoingRequestIds(stored.outgoingRequestIds)
  }, [userId])

  const persist = useCallback(
    (next: {
      friendIds: string[]
      favoriteIds: string[]
      incomingRequestIds: string[]
      outgoingRequestIds: string[]
    }) => {
      if (!userId) {
        return
      }
      writeStored(userId, next)
    },
    [userId],
  )

  const snapshot = useCallback(
    () => ({
      friendIds,
      favoriteIds,
      incomingRequestIds,
      outgoingRequestIds,
    }),
    [friendIds, favoriteIds, incomingRequestIds, outgoingRequestIds],
  )

  const friends = useMemo((): FriendProfile[] => {
    return friendIds
      .map((id) => getShowcaseProfileById(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map(leaderboardEntryToFriendProfile)
      .sort((left, right) => right.xp - left.xp)
  }, [friendIds])

  const incomingRequests = useMemo((): FriendProfile[] => {
    return incomingRequestIds
      .map((id) => getShowcaseProfileById(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map(leaderboardEntryToFriendProfile)
  }, [incomingRequestIds])

  const favoriteFriends = useMemo(
    () => friends.filter((friend) => favoriteIds.includes(friend.id)),
    [friends, favoriteIds],
  )

  const regularFriends = useMemo(
    () => friends.filter((friend) => !favoriteIds.includes(friend.id)),
    [friends, favoriteIds],
  )

  const blockedSearchIds = useMemo(
    () => [...new Set([...friendIds, ...incomingRequestIds, ...outgoingRequestIds])],
    [friendIds, incomingRequestIds, outgoingRequestIds],
  )

  const sendFriendRequest = useCallback(
    (id: string) => {
      if (
        friendIds.includes(id)
        || incomingRequestIds.includes(id)
        || outgoingRequestIds.includes(id)
        || !WEEKLY_LEADERBOARD.some((entry) => entry.id === id)
      ) {
        return false
      }
      const nextOutgoing = [...outgoingRequestIds, id]
      setOutgoingRequestIds(nextOutgoing)
      persist({ ...snapshot(), outgoingRequestIds: nextOutgoing })
      return true
    },
    [friendIds, incomingRequestIds, outgoingRequestIds, persist, snapshot],
  )

  const acceptFriendRequest = useCallback(
    (id: string) => {
      if (!incomingRequestIds.includes(id)) {
        return false
      }
      const nextIncoming = incomingRequestIds.filter((requestId) => requestId !== id)
      const nextFriends = friendIds.includes(id) ? friendIds : [...friendIds, id]
      setIncomingRequestIds(nextIncoming)
      setFriendIds(nextFriends)
      persist({
        ...snapshot(),
        incomingRequestIds: nextIncoming,
        friendIds: nextFriends,
      })
      return true
    },
    [incomingRequestIds, friendIds, persist, snapshot],
  )

  const rejectFriendRequest = useCallback(
    (id: string) => {
      if (!incomingRequestIds.includes(id)) {
        return false
      }
      const nextIncoming = incomingRequestIds.filter((requestId) => requestId !== id)
      setIncomingRequestIds(nextIncoming)
      persist({ ...snapshot(), incomingRequestIds: nextIncoming })
      return true
    },
    [incomingRequestIds, persist, snapshot],
  )

  const hasOutgoingRequest = useCallback(
    (id: string) => outgoingRequestIds.includes(id),
    [outgoingRequestIds],
  )

  const removeFriend = useCallback(
    (id: string) => {
      const nextFriends = friendIds.filter((friendId) => friendId !== id)
      const nextFavorites = favoriteIds.filter((friendId) => friendId !== id)
      setFriendIds(nextFriends)
      setFavoriteIds(nextFavorites)
      persist({
        ...snapshot(),
        friendIds: nextFriends,
        favoriteIds: nextFavorites,
      })
    },
    [friendIds, favoriteIds, persist, snapshot],
  )

  const toggleFavorite = useCallback(
    (id: string) => {
      const next = favoriteIds.includes(id)
        ? favoriteIds.filter((friendId) => friendId !== id)
        : [...favoriteIds, id]
      setFavoriteIds(next)
      persist({ ...snapshot(), favoriteIds: next })
    },
    [favoriteIds, persist, snapshot],
  )

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds])

  const getFriendRankAmongFriends = useCallback(
    (userXp: number): number => {
      const higher = friends.filter((friend) => friend.xp > userXp).length
      return higher + 1
    },
    [friends],
  )

  return {
    friends,
    favoriteFriends,
    regularFriends,
    friendIds,
    incomingRequests,
    incomingRequestCount: incomingRequests.length,
    blockedSearchIds,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    hasOutgoingRequest,
    removeFriend,
    toggleFavorite,
    isFavorite,
    getFriendRankAmongFriends,
  }
}
