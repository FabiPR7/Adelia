import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import type { CustomerNotification } from '../types/notifications'
import {
  fetchCustomerNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeCustomerNotifications,
} from '../services/customerNotifications'

export function useCustomerNotifications() {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid || profile?.role !== 'customer') {
      setNotifications([])
      setUnreadCount(0)
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
            setUnreadCount(payload.unreadCount)
          })
          .finally(() => setLoading(false))
      },
    )

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const count = snapshot.data()?.notificationUnreadCount
      if (typeof count === 'number') {
        setUnreadCount(count)
      } else {
        setUnreadCount(notifications.filter((item) => !item.read).length)
      }
    })

    void fetchCustomerNotifications()
      .then((payload) => {
        setNotifications(payload.notifications)
        setUnreadCount(payload.unreadCount)
      })
      .catch(() => undefined)

    return () => {
      unsubscribeNotifications()
      unsubscribeUser()
    }
  }, [user?.uid, profile?.role])

  useEffect(() => {
    setUnreadCount(notifications.filter((item) => !item.read).length)
  }, [notifications])

  const markRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true, readAt: new Date().toISOString() } : item,
      ),
    )
    setUnreadCount((current) => Math.max(0, current - 1))
    await markNotificationRead(notificationId)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() })),
    )
    setUnreadCount(0)
    await markAllNotificationsRead()
  }, [])

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read),
    [notifications],
  )

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  }
}
