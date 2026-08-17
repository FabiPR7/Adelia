import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { CompanyNotification } from '../types/companyNotifications'
import {
  fetchCompanyNotifications,
  markAllCompanyNotificationsRead,
  markCompanyNotificationRead,
  subscribeCompanyNotifications,
} from '../services/companyGamification'

export function useCompanyNotifications() {
  const { profile, company } = useAuth()
  const companyId = company?.id ?? profile?.companyId ?? ''
  const [notifications, setNotifications] = useState<CompanyNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId || profile?.role !== 'company') {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeCompanyNotifications(
      companyId,
      (rows) => {
        setNotifications(rows)
        setLoading(false)
      },
      () => {
        void fetchCompanyNotifications()
          .then((payload) => setNotifications(payload.notifications))
          .finally(() => setLoading(false))
      },
    )

    void fetchCompanyNotifications()
      .then((payload) => setNotifications(payload.notifications))
      .catch(() => undefined)

    return () => {
      unsubscribe()
    }
  }, [companyId, profile?.role])

  const markRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true, readAt: new Date().toISOString() } : item,
      ),
    )
    await markCompanyNotificationRead(notificationId)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() })),
    )
    await markAllCompanyNotificationsRead()
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  }
}
