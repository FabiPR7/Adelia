export interface FriendProfile {
  id: string
  displayName: string
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
