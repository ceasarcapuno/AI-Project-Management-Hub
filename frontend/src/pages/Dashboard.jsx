// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — main authenticated shell: sidebar + topbar + content + chatbar
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { T } from '../utils/constants'
import * as api from '../services/api'

import TopBar         from '../components/layout/TopBar'
import Sidebar        from '../components/layout/Sidebar'
import AIPMChatBar    from '../components/layout/AIPMChatBar'
import HomeView       from '../views/HomeView'
import ProjectDetail  from '../components/project/ProjectDetail'
import NotificationPanel from '../components/notifications/NotificationPanel'
import Settings       from './Settings'

export default function Dashboard() {
  const {
    user,
    workspaces, refreshWorkspaces,
    projects,   refreshProjects,
    activeProject, setActiveProject,
    activeWorkspace, setActiveWorkspace,
    notifications, refreshNotifications, setNotifications,
  } = useApp()

  // ── Layout state ────────────────────────────────────────────────────────
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [showNotifs,   setShowNotifs]   = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isMobile,     setIsMobile]     = useState(window.innerWidth < 768)
  const [isTablet,     setIsTablet]     = useState(window.innerWidth < 1024)

  // ── Project detail state ─────────────────────────────────────────────────
  const [milestones,     setMilestones]     = useState([])
  const [tasks,          setTasks]          = useState([])
  const [agents,         setAgents]         = useState([])
  const [outputs,        setOutputs]        = useState([])
  const [threadMessages, setThreadMessages] = useState([])
  const [sending,        setSending]        = useState(false)

  // ── Responsive handler ───────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      const w = window.innerWidth
      setIsMobile(w < 768)
      setIsTablet(w < 1024)
      if (w < 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    if (window.innerWidth < 768) setSidebarOpen(false)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Bootstrap data on mount ──────────────────────────────────────────────
  useEffect(() => {
    refreshWorkspaces()
    refreshNotifications()
  }, [])

  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces])

  useEffect(() => {
    if (activeWorkspace?.id) refreshProjects(activeWorkspace.id)
  }, [activeWorkspace?.id])

  // ── Load project detail when activeProject changes ───────────────────────
  useEffect(() => {
    if (!activeProject?.id) {
      setMilestones([])
      setTasks([])
      setAgents([])
      setOutputs([])
      setThreadMessages([])
      return
    }
    loadProjectDetail(activeProject.id)
  }, [activeProject?.id])

  const loadProjectDetail = useCallback(async (projectId) => {
    try {
      const [ms, ag, th] = await Promise.all([
        api.milestones.list(projectId),
        api.agents.list(projectId),
        api.chat.getThread(projectId),
      ])
      setMilestones(ms)
      setAgents(ag)
      setThreadMessages(th)

      // Flatten tasks from milestones
      const allTasks = ms.flatMap(m => m.tasks || [])
      setTasks(allTasks)

      // Load outputs for each task
      const outputResults = await Promise.all(
        allTasks.map(t => api.outputs.list({ task_id: t.id }).catch(() => []))
      )
      setOutputs(outputResults.flat())
    } catch (err) {
      console.error('[Dashboard] loadProjectDetail error:', err)
    }
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenProject = useCallback((project) => {
    setActiveProject(project)
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  const handleOpenHome = useCallback(() => {
    setActiveProject(null)
  }, [])

  const handleRunTask = useCallback(async (taskId) => {
    try {
      await api.tasks.run(taskId)
      if (activeProject?.id) await loadProjectDetail(activeProject.id)
    } catch (err) {
      console.error('[Dashboard] handleRunTask error:', err)
    }
  }, [activeProject?.id, loadProjectDetail])

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || !activeProject?.id) return
    setSending(true)
    try {
      await api.chat.sendToProject(activeProject.id, text)
      const th = await api.chat.getThread(activeProject.id)
      setThreadMessages(th)
    } catch (err) {
      console.error('[Dashboard] handleSendMessage error:', err)
    } finally {
      setSending(false)
    }
  }, [activeProject?.id])

  const handleMarkRead = useCallback(async (id) => {
    try {
      await api.notifications.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (err) {
      console.error('[Dashboard] handleMarkRead error:', err)
    }
  }, [])

  // ── Computed values ───────────────────────────────────────────────────────
  const unreadCount  = notifications.filter(n => !n.read).length
  const urgentCount  = notifications.filter(n => !n.read && n.level === 'critical').length

  const breadcrumb = activeProject
    ? { project: activeProject.name, ws: activeWorkspace?.label }
    : { ws: activeWorkspace?.label }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:    'flex',
      height:     '100vh',
      overflow:   'hidden',
      background: T.bg,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        isTablet={isTablet}
        isDesktop={!isTablet}
        activeWs={showSettings ? 'settings' : activeWorkspace?.type}
        setActiveWs={(wsType) => {
          if (wsType === 'settings') { setShowSettings(true); return }
          setShowSettings(false)
          const ws = workspaces.find(w => w.type === wsType)
          if (ws) setActiveWorkspace(ws)
        }}
        activeProject={activeProject}
        onOpenProject={handleOpenProject}
        onOpenHome={handleOpenHome}
        workspaces={workspaces}
        projects={projects}
        agents={agents}
        allProjects={projects}
      />

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.4)',
            zIndex:     40,
          }}
        />
      )}

      {/* Main column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TopBar */}
        <TopBar
          isMobile={isMobile}
          onMenuClick={() => setSidebarOpen(o => !o)}
          breadcrumb={breadcrumb}
          onNotifClick={() => setShowNotifs(o => !o)}
          showNotifs={showNotifs}
          unreadCount={unreadCount}
          urgentCount={urgentCount}
          user={user}
        />

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeProject ? (
            <ProjectDetail
              project={activeProject}
              milestones={milestones}
              tasks={tasks}
              agents={agents}
              outputs={outputs}
              threadMessages={threadMessages}
              onRunTask={handleRunTask}
              onSendMessage={handleSendMessage}
              sending={sending}
              notifications={notifications}
            />
          ) : (
            <HomeView
              projects={projects}
              workspaces={workspaces}
              notifications={notifications}
              onOpenProject={handleOpenProject}
            />
          )}

          {/* Notification panel */}
          {showNotifs && (
            <NotificationPanel
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onClose={() => setShowNotifs(false)}
            />
          )}
        </div>

        {/* AIPM Chat bar */}
        <AIPMChatBar projectId={activeProject?.id ?? null} />
      </div>

      {/* Settings modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
