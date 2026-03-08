// ═══════════════════════════════════════════════════════════════════════════
// AppContext — global state management for AIPM
// Manages: user, session, workspaces, activeWorkspace, projects,
//          activeProject, notifications, loading states, real-time subs
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../services/supabase'
import * as api from '../services/api'

// ─── Context Definition ───────────────────────────────────────────────────────
const AppContext = createContext(null)

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [user,            setUser]            = useState(null)
  const [session,         setSession]         = useState(null)
  const [authLoading,     setAuthLoading]     = useState(true)

  const [workspaces,      setWorkspaces]      = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)

  const [projects,        setProjects]        = useState([])
  const [activeProject,   setActiveProject]   = useState(null)

  const [notifications,   setNotifications]   = useState([])

  // Ref to store the thread message callback (set by Dashboard when viewing a project)
  const threadMessageCallback = useRef(null)

  // Real-time subscription refs
  const notifSubRef  = useRef(null)
  const threadSubRef = useRef(null)

  // ─── Auth: Check session on mount + listen for changes ─────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAuthLoading(false)

      // Clear data on sign-out
      if (!s) {
        setWorkspaces([])
        setProjects([])
        setNotifications([])
        setActiveWorkspace(null)
        setActiveProject(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ─── Real-time: Notifications table ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      // Cleanup existing subscription
      if (notifSubRef.current) {
        supabase.removeChannel(notifSubRef.current)
        notifSubRef.current = null
      }
      return
    }

    // Subscribe to notifications for this user
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            )
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    notifSubRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      notifSubRef.current = null
    }
  }, [user?.id])

  // ─── Real-time: Thread messages ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeProject?.id) {
      if (threadSubRef.current) {
        supabase.removeChannel(threadSubRef.current)
        threadSubRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`thread:${activeProject.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'thread_messages',
          filter: `project_id=eq.${activeProject.id}`,
        },
        (payload) => {
          if (threadMessageCallback.current) {
            threadMessageCallback.current(payload.new)
          }
        }
      )
      .subscribe()

    threadSubRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      threadSubRef.current = null
    }
  }, [activeProject?.id])

  // ─── Data Fetchers ──────────────────────────────────────────────────────────
  const refreshProjects = useCallback(async (workspaceId) => {
    try {
      const data = await api.projects.list(workspaceId)
      setProjects(data)
    } catch (err) {
      console.error('[AppContext] refreshProjects error:', err)
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await api.notifications.list()
      setNotifications(data)
    } catch (err) {
      console.error('[AppContext] refreshNotifications error:', err)
    }
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await api.workspaces.list()
      setWorkspaces(data)
    } catch (err) {
      console.error('[AppContext] refreshWorkspaces error:', err)
    }
  }, [])

  // ─── Register thread message callback ──────────────────────────────────────
  const setThreadMessageCallback = useCallback((cb) => {
    threadMessageCallback.current = cb
  }, [])

  // ─── Context Value ──────────────────────────────────────────────────────────
  const value = {
    // Auth
    user,
    session,
    authLoading,

    // Workspaces
    workspaces,
    setWorkspaces,
    activeWorkspace,
    setActiveWorkspace,
    refreshWorkspaces,

    // Projects
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    refreshProjects,

    // Notifications
    notifications,
    setNotifications,
    refreshNotifications,

    // Real-time thread
    setThreadMessageCallback,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { AppContext }
