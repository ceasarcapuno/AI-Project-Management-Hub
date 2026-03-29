// ═══════════════════════════════════════════════════════════════════════════
// Sidebar — main navigation sidebar
// Props: sidebarOpen, setSidebarOpen, isMobile, isTablet, isDesktop,
//        activeWs, setActiveWs, activeProject, onOpenProject, onOpenHome,
//        workspaces, projects, agents, allProjects
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { T, WS } from '../../utils/constants'
import { pct } from '../../utils/helpers'

// ─── helpers ─────────────────────────────────────────────────────────────────
function totalCost(agents = []) {
  return agents.reduce((sum, a) => sum + (a.total_cost || a.cost || 0), 0)
}

// ─── Sidebar Component ────────────────────────────────────────────────────────
export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  isMobile,
  isTablet,
  isDesktop,
  activeWs,
  setActiveWs,
  activeProject,
  onOpenProject,
  onOpenHome,
  workspaces = [],
  projects   = [],
  agents     = [],
  allProjects = [],
}) {
  const open = sidebarOpen

  // Count projects needing attention (blocked or has unread urgent notifications)
  const needsAttentionCount = useMemo(() =>
    allProjects.filter(p => p.needs_attention || p.blocked).length,
    [allProjects]
  )

  // Total cost across all agents
  const costTotal = useMemo(() => totalCost(agents), [agents])

  // Sidebar width
  const sidebarW = open ? 232 : 60

  // On mobile, sidebar hides entirely — rendered as overlay from Dashboard
  if (isMobile) return null

  return (
    <aside style={{
      width:      sidebarW,
      minWidth:   sidebarW,
      height:     '100%',
      background: T.surface,
      borderRight: `1px solid ${T.border}`,
      display:    'flex',
      flexDirection: 'column',
      transition: 'width 0.22s ease',
      overflow:   'hidden',
      zIndex:     10,
      flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* ── Logo + toggle ─────────────────────────────────────────────── */}
      <div style={{
        padding:     '18px 14px 14px',
        borderBottom: `1px solid ${T.borderLight}`,
        display:     'flex',
        alignItems:  'center',
        gap:         10,
        flexShrink:  0,
      }}>
        {/* Logo icon */}
        <div style={{
          width:          36,
          height:         36,
          borderRadius:   10,
          background:     T.accent,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       18,
          flexShrink:     0,
        }}>
          🤖
        </div>

        {open && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily:  "'Fraunces', Georgia, serif",
              fontSize:    16,
              fontWeight:  900,
              color:       T.text,
              lineHeight:  1,
            }}>
              AI PM
            </div>
            <div style={{ fontSize: 10, color: T.textSoft, marginTop: 2 }}>
              Smart project manager
            </div>
          </div>
        )}

        {/* Collapse / expand toggle */}
        <button
          onClick={() => setSidebarOpen(!open)}
          style={{
            marginLeft:   open ? 'auto' : undefined,
            width:        24,
            height:       24,
            borderRadius: 6,
            border:       `1px solid ${T.border}`,
            background:   T.bg,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     11,
            color:        T.textMid,
            flexShrink:   0,
            transition:   'background 0.15s',
          }}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? '‹' : '›'}
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>

        {/* Overview nav item */}
        <NavItem
          icon="🏠"
          label="Overview"
          open={open}
          active={activeWs === 'home' && !activeProject}
          badge={needsAttentionCount > 0 ? needsAttentionCount : null}
          onClick={() => { setActiveWs('home'); onOpenHome() }}
        />

        {/* Divider */}
        <div style={{ height: 1, background: T.borderLight, margin: '8px 4px' }} />
        {open && (
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textSoft, letterSpacing: '0.08em', padding: '4px 8px 6px', textTransform: 'uppercase' }}>
            Workspaces
          </div>
        )}

        {/* Workspace sections */}
        {(['private', 'business', 'work']).map(wsKey => {
          const ws   = WS[wsKey]
          const wsProjects = projects.filter(p => {
            if (p.workspace_type === wsKey) return true
            const foundWs = workspaces.find(w => w.id === p.workspace_id)
            return foundWs?.type === wsKey || foundWs?.workspace_type === wsKey
          })
          const isActive = activeWs === wsKey

          return (
            <div key={wsKey}>
              {/* Workspace nav item */}
              <NavItem
                icon={ws.icon}
                label={ws.label}
                open={open}
                active={isActive && !activeProject}
                onClick={() => { setActiveWs(wsKey); onOpenHome() }}
                iconColor={ws.color}
              />

              {/* Projects under this workspace — only when expanded and active */}
              {open && isActive && wsProjects.length > 0 && (
                <div style={{ paddingLeft: 8, marginBottom: 4 }}>
                  {wsProjects.map(proj => {
                    const isActiveProj = activeProject?.id === proj.id
                    const doneTasks  = proj.tasks_done  || proj.done_count  || 0
                    const totalTasks = proj.tasks_total || proj.total_count || 0
                    const progress   = pct(doneTasks, totalTasks)

                    return (
                      <button
                        key={proj.id}
                        onClick={() => onOpenProject(proj)}
                        style={{
                          display:      'flex',
                          alignItems:   'center',
                          gap:          7,
                          width:        '100%',
                          padding:      '5px 8px',
                          borderRadius: 8,
                          border:       'none',
                          background:   isActiveProj ? T.accentSoft : 'transparent',
                          cursor:       'pointer',
                          textAlign:    'left',
                          marginBottom: 1,
                          transition:   'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!isActiveProj) e.currentTarget.style.background = T.bg }}
                        onMouseLeave={e => { if (!isActiveProj) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0 }}>
                          {proj.emoji || '📁'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize:     11,
                            fontWeight:   isActiveProj ? 700 : 500,
                            color:        isActiveProj ? T.accent : T.text,
                            overflow:     'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace:   'nowrap',
                          }}>
                            {proj.name}
                          </div>
                          {/* Mini progress bar */}
                          {totalTasks > 0 && (
                            <div style={{
                              height:       2,
                              background:   T.borderLight,
                              borderRadius: 999,
                              marginTop:    3,
                              overflow:     'hidden',
                            }}>
                              <div style={{
                                width:      `${progress}%`,
                                height:     '100%',
                                background: progress === 100 ? T.green : T.accent,
                                borderRadius: 999,
                              }} />
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Divider */}
        <div style={{ height: 1, background: T.borderLight, margin: '8px 4px' }} />

        {/* Team / All Agents */}
        <NavItem
          icon="🤖"
          label="All Agents"
          open={open}
          active={activeWs === 'team'}
          onClick={() => setActiveWs('team')}
        />

        {/* Settings */}
        <NavItem
          icon="⚙️"
          label="Settings"
          open={open}
          active={activeWs === 'settings'}
          onClick={() => setActiveWs('settings')}
        />
      </nav>

      {/* ── Cost footer ───────────────────────────────────────────────── */}
      {open && costTotal > 0 && (
        <div style={{
          padding:      '12px 14px',
          borderTop:    `1px solid ${T.borderLight}`,
          background:   T.bg,
          flexShrink:   0,
        }}>
          <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 3, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Total cost today
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>
            ${costTotal.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: T.textSoft, marginTop: 1 }}>
            across {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </aside>
  )
}

// ─── NavItem helper ───────────────────────────────────────────────────────────
function NavItem({ icon, label, open, active, badge, onClick, iconColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          open ? 9 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        width:        '100%',
        padding:      open ? '7px 10px' : '8px 0',
        borderRadius: 8,
        border:       'none',
        background:   active ? T.accentSoft : 'transparent',
        cursor:       'pointer',
        marginBottom: 1,
        position:     'relative',
        transition:   'background 0.12s',
        fontFamily:   "'DM Sans', sans-serif",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.bg }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Icon */}
      <span style={{
        fontSize:  17,
        lineHeight: 1,
        flexShrink: 0,
        color:      iconColor,
      }}>
        {icon}
      </span>

      {/* Label — only when expanded */}
      {open && (
        <span style={{
          fontSize:  12,
          fontWeight: active ? 700 : 500,
          color:      active ? T.accent : T.textMid,
          flex:       1,
          textAlign:  'left',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}

      {/* Badge */}
      {badge != null && (
        <span style={{
          position:     open ? 'static' : 'absolute',
          top:          open ? undefined : 4,
          right:        open ? undefined : 4,
          minWidth:     16,
          height:       16,
          borderRadius: 999,
          background:   T.red,
          color:        '#fff',
          fontSize:     9,
          fontWeight:   700,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          padding:      '0 4px',
        }}>
          {badge}
        </span>
      )}
    </button>
  )
}
