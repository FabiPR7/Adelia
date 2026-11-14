export interface FriendProfile {
  id: string
  displayName: string
  /** @usuario (sin @); vacío si no tiene. */
  username?: string
  xp: number
  level: number
  levelTitle: string
  levelProgress: number
  missionsCompleted: number
  reservationsTotal: number
  streak: number
  photoUrl?: string
  homeCountry: string
  homeCity?: string
  foodPreferences: string[]
  badgeIds: string[]
}

export interface StoredFriendsState {
  friendIds: string[]
  favoriteIds: string[]
  incomingRequestIds: string[]
  outgoingRequestIds: string[]
}
