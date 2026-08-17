import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { CustomerNotification } from '../types/notifications'
import { isPhantomBadgeNotification } from '../utils/gamificationBadges'
import {
  fetchCustomerNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeCustomerNotifications,
} from '../services/customerNotifications'

export function useCustomerNotifications() {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid || profile?.role !== 'customer') {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribeNotifications = subscribeCustomerNotifications(
      user.uid,
      (rows) => {
        setNotifications(rows)
        setLoading(false)
      },
      () => {
        void fetchCustomerNotifications()
          .then((payload) => {
            setNotifications(payload.notifications)
          })
          .finally(() => setLoading(false))
      },
    )

    void fetchCustomerNotifications()
      .then((payload) => {
        setNotifications(payload.notifications)
      })
      .catch(() => undefined)

    return () => {
      unsubscribeNotifications()
    }
  }, [user?.uid, profile?.role])

  const markRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true, readAt: new Date().toISOString() } : item,
      ),
    )
    await markNotificationRead(notificationId)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() })),
    )
    await markAllNotificationsRead()
  }, [])

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !isPhantomBadgeNotification(item)),
    [notifications],
  )

  const unreadNotifications = useMemo(
    () => visibleNotifications.filter((item) => !item.read),
    [visibleNotifications],
  )

  return {
    notifications: visibleNotifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    loading,
    markRead,
    markAllRead,
  }
}
