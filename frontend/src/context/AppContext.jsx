// ═══════════════════════════════════════════════════════════════════════════
// AppContext — global state management for AIPM (self-hosted, JWT auth)
// Real-time notifications delivered via SSE (/api/notifications/stream).
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import * as api from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user,            setUser]            = useState(() => {
    try { return JSON.parse(localStorage.getItem('aipm_user')) } catch { return null }
  })
  const [authLoading,     setAuthLoading]     = useState(true)

  const [workspaces,      setWorkspaces]      = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)

  const [projects,        setProjects]        = useState([])
  const [activeProject,   setActiveProject]   = useState(null)

  const [notifications,   setNotifications]   = useState([])

  const threadMessageCallback = useRef(null)
  const sseRef                = useRef(null)

  // ─── Auth: verify token on mount ────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('aipm_token')
    if (!token) {
      setAuthLoading(false)
      return
    }
    api.auth.me()
      .then(u => {
        setUser(u)
        localStorage.setItem('aipm_user', JSON.stringify(u))
      })
      .catch(() => {
        // Token invalid — clear storage
        localStorage.removeItem('aipm_token')
        localStorage.removeItem('aipm_user')
        setUser(null)
      })
      .finally(() => setAuthLoading(false))
  }, [])

  // ─── SSE: connect to notification stream when logged in ─────────────────
  useEffect(() => {
    if (!user?.id) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
      return
    }

    const token = localStorage.getItem('aipm_token')
    if (!token) return

    const baseURL = import.meta.env.VITE_API_URL || '/api'
    const es = new EventSource(`${baseURL}/notifications/stream?token=${token}`)

    es.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data)
        setNotifications(prev => [notif, ...prev])
      } catch (_) {}
    }

    es.onerror = () => {
      // EventSource will auto-reconnect; nothing to do
    }

    sseRef.current = es

    return () => { es.close(); sseRef.current = null }
  }, [user?.id])

  // ─── Auth helpers ────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const { token, user: u } = await api.auth.login({ email, password })
    localStorage.setItem('aipm_token', token)
    localStorage.setItem('aipm_user', JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const register = useCallback(async ({ email, password, name }) => {
    const { token, user: u } = await api.auth.register({ email, password, name })
    localStorage.setItem('aipm_token', token)
    localStorage.setItem('aipm_user', JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('aipm_token')
    localStorage.removeItem('aipm_user')
    setUser(null)
    setWorkspaces([])
    setProjects([])
    setNotifications([])
    setActiveWorkspace(null)
    setActiveProject(null)
  }, [])

  // ─── Data Fetchers ───────────────────────────────────────────────────────
  const refreshProjects = useCallback(async (workspaceId) => {
    try {
      const data = await api.projects.list(workspaceId)
      setProjects(data)
    } catch (err) { console.error('[AppContext] refreshProjects error:', err) }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await api.notifications.list()
      setNotifications(data)
    } catch (err) { console.error('[AppContext] refreshNotifications error:', err) }
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await api.workspaces.list()
      setWorkspaces(data)
    } catch (err) { console.error('[AppContext] refreshWorkspaces error:', err) }
  }, [])

  const setThreadMessageCallback = useCallback((cb) => {
    threadMessageCallback.current = cb
  }, [])

  const value = {
    user, authLoading,
    login, register, logout,
    workspaces, setWorkspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces,
    projects, setProjects, activeProject, setActiveProject, refreshProjects,
    notifications, setNotifications, refreshNotifications,
    setThreadMessageCallback,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { AppContext }
