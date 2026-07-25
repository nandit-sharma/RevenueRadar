'use client'

import { useState, useEffect, useCallback } from 'react'
import { getUploadStatus } from './api'

interface SessionStatus {
  hasData: boolean
  active: boolean
  filename: string
  rows: number
  columns: string[]
  ragReady: boolean
  loading: boolean
}

const SESSION_CHANGE_EVENT = 'revenueradar_session_changed'

export function useSessionStatus() {
  const [status, setStatus] = useState<SessionStatus>({
    hasData: false,
    active: false,
    filename: '',
    rows: 0,
    columns: [],
    ragReady: false,
    loading: true,
  })

  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  useEffect(() => {
    let mounted = true

    const fetchStatus = async () => {
      try {
        const res = await getUploadStatus()
        if (mounted) {
          setStatus({
            hasData: res.has_data || false,
            active: res.active || false,
            filename: res.filename || '',
            rows: res.rows || 0,
            columns: res.columns || [],
            ragReady: res.rag_ready || false,
            loading: false,
          })
        }
      } catch {
        if (mounted) {
          setStatus(prev => ({ ...prev, loading: false }))
        }
      }
    }

    fetchStatus()

    return () => { mounted = false }
  }, [refreshKey])

  // Listen for session change events (same tab)
  useEffect(() => {
    const handler = () => {
      refresh()
    }

    const storageHandler = (e: StorageEvent) => {
      if (e.key === SESSION_CHANGE_EVENT) {
        refresh()
      }
    }

    window.addEventListener(SESSION_CHANGE_EVENT, handler)
    window.addEventListener('storage', storageHandler)

    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [refresh])

  return { ...status, refresh }
}

/** Call this to notify all pages that the session has changed */
export function broadcastSessionChange() {
  // Same-tab notification via custom event
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
  // Cross-tab notification via localStorage
  try {
    localStorage.setItem(SESSION_CHANGE_EVENT, Date.now().toString())
  } catch {}
}
