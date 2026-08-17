import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FriendProfile } from '../types/friends'
import {
  acceptFriendRequest as acceptFriendRequestApi,
  fetchFriendsState,
  rejectFriendRequest as rejectFriendRequestApi,
  removeFriend as removeFriendApi,
  sendFriendRequest as sendFriendRequestApi,
  toggleFriendFavorite as toggleFriendFavoriteApi,
} from '../services/customerFriends'

const EMPTY: FriendProfile[] = []

export function useCustomerFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<FriendProfile[]>(EMPTY)
  const [incomingRequests, setIncomingRequests] = useState<FriendProfile[]>(EMPTY)
  const [outgoingIds, setOutgoingIds] = useState<string[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) {
      setFriends(EMPTY)
      setIncomingRequests(EMPTY)
      setOutgoingIds([])
      setFavoriteIds([])
      return
    }
    setLoading(true)
    try {
      const state = await fetchFriendsState()
      setFriends(state.friends ?? [])
      setIncomingRequests(state.incoming ?? [])
      setOutgoingIds(state.outgoingRequestIds ?? [])
      setFavoriteIds(state.favoriteIds ?? [])
    } catch {
      setFriends(EMPTY)
      setIncomingRequests(EMPTY)
      setOutgoingIds([])
      setFavoriteIds([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const friendIds = useMemo(() => friends.map((friend) => friend.id), [friends])
  const incomingRequestIds = useMemo(
    () => incomingRequests.map((friend) => friend.id),
    [incomingRequests],
  )

  const favoriteFriends = useMemo(
    () => friends.filter((friend) => favoriteIds.includes(friend.id)),
    [friends, favoriteIds],
  )
  const regularFriends = useMemo(
    () => friends.filter((friend) => !favoriteIds.includes(friend.id)),
    [friends, favoriteIds],
  )
  const blockedSearchIds = useMemo(
    () => [...new Set([...friendIds, ...incomingRequestIds, ...outgoingIds])],
    [friendIds, incomingRequestIds, outgoingIds],
  )

  const sendFriendRequest = useCallback(
    async (id: string) => {
      if (blockedSearchIds.includes(id)) {
        throw new Error('Ya sois amigos o ya hay una solicitud pendiente.')
      }
      await sendFriendRequestApi(id)
      setOutgoingIds((current) => (current.includes(id) ? current : [...current, id]))
      await reload()
    },
    [blockedSearchIds, reload],
  )

  const acceptFriendRequest = useCallback(
    (id: string) => {
      void acceptFriendRequestApi(id)
        .then(() => reload())
        .catch(() => undefined)
      return true
    },
    [reload],
  )

  const rejectFriendRequest = useCallback(
    (id: string) => {
      void rejectFriendRequestApi(id)
        .then(() => reload())
        .catch(() => undefined)
      return true
    },
    [reload],
  )

  const hasOutgoingRequest = useCallback(
    (id: string) => outgoingIds.includes(id),
    [outgoingIds],
  )

  const removeFriend = useCallback(
    (id: string) => {
      void removeFriendApi(id)
        .then(() => reload())
        .catch(() => undefined)
    },
    [reload],
  )

  const toggleFavorite = useCallback(
    (id: string) => {
      void toggleFriendFavoriteApi(id)
        .then((favorite) => {
          setFavoriteIds((current) => (
            favorite
              ? [...new Set([...current, id])]
              : current.filter((friendId) => friendId !== id)
          ))
        })
        .catch(() => undefined)
    },
    [],
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
    loading,
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
