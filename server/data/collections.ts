/** Colecciones top-level. No meter grafos ni progreso gordo en users/companies. */
export const COLLECTIONS = {
  users: 'users',
  companies: 'companies',
  restaurantIndex: 'restaurantIndex',
  reservations: 'reservations',
  tables: 'tables',
  friendships: 'friendships',
  friendRequests: 'friendRequests',
  friendFavorites: 'friendFavorites',
  reservationInvites: 'reservationInvites',
  reservationChallenges: 'reservationChallenges',
  userGamification: 'userGamification',
  companyGamification: 'companyGamification',
  promotionClaims: 'promotionClaims',
  userFavorites: 'userFavorites',
  reviewIndex: 'reviewIndex',
  productClaims: 'productClaims',
  companyCredentials: 'companyCredentials',
  logins: 'logins',
  notificationJobs: 'notificationJobs',
  missionCatalog: 'missionCatalog',
  levelCatalog: 'levelCatalog',
  gameConfig: 'gameConfig',
  saasSubscriptions: 'saasSubscriptions',
} as const

export function friendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_')
}

export function friendFavoriteId(ownerUid: string, friendUid: string): string {
  return `${ownerUid}_${friendUid}`
}

export function friendRequestId(fromUid: string, toUid: string): string {
  return `${fromUid}_${toUid}`
}

export function reservationInviteId(reservationId: string, toUid: string): string {
  return `${reservationId}_${toUid}`.slice(0, 240)
}
