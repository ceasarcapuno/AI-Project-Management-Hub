// ═══════════════════════════════════════════════════════════════════════════
// HomeView — overview dashboard with stats, needs-input section, workspace cards
// Props: projects (flat array), workspaces, notifications, onOpenProject
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { T, WS, TASK_STATUS } from '../../utils/constants'
import { pct, fmtDueDate } from '../../utils/helpers'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{
      padding:      '14px 16px',
      borderRadius: 12,
      background:   bg || T.surface,
      border:       `1px solid ${T.border}`,
      display:      'flex',
      flexDirection: 'column',
      gap:          4,
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{
        fontSize:   22,
        fontWeight: 800,
        color:      color || T.text,
        lineHeight: 1,
        fontFamily: "'Fraunces', Georgia, serif",
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: T.textSoft }}>{sub}</div>}
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, wsInfo, onOpenProject }) {
  const doneTasks  = project.tasks_done  || project.done_count  || 0
  const totalTasks = project.tasks_total || project.total_count || 0
  const progress   = pct(doneTasks, totalTasks)

  const cost = project.total_cost || project.cost || 0

  return (
    <div
      onClick={() => onOpenProject(project)}
      style={{
        padding:      '12px 14px',
        borderRadius: 11,
        border:       `1.5px solid ${T.border}`,
        background:   T.surface,
        cursor:       'pointer',
        transition:   'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
        fontFamily:   "'DM Sans', sans-serif",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.accentBorder
        e.currentTarget.style.boxShadow  = '0 2px 12px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform  = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border
        e.currentTarget.style.boxShadow  = 'none'
        e.currentTarget.style.transform  = 'none'
      }}
    >
      {/* Emoji + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 20 }}>{project.emoji || '📁'}</span>
        <span style={{
          fontSize:     12,
          fontWeight:   700,
          color:        T.text,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          flex:         1,
        }}>
          {project.name}
        </span>
        {cost > 0 && (
          <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, flexShrink: 0 }}>
            ${cost.toFixed(2)}
          </span>
        )}
      </div>

      {/* Goal */}
      {project.goal && (
        <p style={{
          fontSize:     11,
          color:        T.textSoft,
          margin:       '0 0 8px',
          lineHeight:   1.4,
          overflow:     'hidden',
          display:      '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {project.goal}
        </p>
      )}

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <div style={{
            flex:         1,
            height:       4,
            background:   '#ece9e4',
            borderRadius: 999,
            overflow:     'hidden',
          }}>
            <div style={{
              width:      `${progress}%`,
              height:     '100%',
              background: progress === 100 ? T.green : T.accent,
              borderRadius: 999,
            }} />
          </div>
          <span style={{ fontSize: 9, color: T.textSoft, whiteSpace: 'nowrap' }}>
            {doneTasks}/{totalTasks}
          </span>
        </div>
      )}

      {/* Footer: due date */}
      {project.due_date && (
        <div style={{ fontSize: 10, color: T.textSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>📅</span> Due {fmtDueDate(project.due_date)}
        </div>
      )}
    </div>
  )
}

// ─── HomeView ─────────────────────────────────────────────────────────────────
export default function HomeView({ projects = [], workspaces = [], notifications = [], onOpenProject }) {
  // ─── Stats computation ───────────────────────────────────────────────────
  const totalProjects = projects.length

  const { doneCount, totalCount } = useMemo(() => {
    let done = 0, total = 0
    projects.forEach(p => {
      done  += p.tasks_done  || p.done_count  || 0
      total += p.tasks_total || p.total_count || 0
    })
    return { doneCount: done, totalCount: total }
  }, [projects])

  // Projects that need user input (unread urgent/decision notifications)
  const needsInputProjectIds = useMemo(() => {
    const ids = new Set()
    notifications
      .filter(n => !n.read && ['decision', 'approval', 'token-warning', 'blocker'].includes(n.type))
      .forEach(n => { if (n.project_id) ids.add(n.project_id) })
    return ids
  }, [notifications])

  const needsInputProjects = useMemo(() =>
    projects.filter(p => needsInputProjectIds.has(p.id)),
    [projects, needsInputProjectIds]
  )

  // Cost today
  const costToday = useMemo(() =>
    projects.reduce((sum, p) => sum + (p.cost_today || p.total_cost || p.cost || 0), 0),
    [projects]
  )

  // Workspace ordering
  const wsOrder = ['private', 'business', 'work']

  // Group projects by workspace type
  const projectsByWs = useMemo(() => {
    const map = {}
    wsOrder.forEach(k => { map[k] = [] })
    projects.forEach(p => {
      const wt = p.workspace_type || p.workspace?.type || 'private'
      if (map[wt]) map[wt].push(p)
      else map['private'].push(p)
    })
    return map
  }, [projects])

  return (
    <div style={{
      height:    '100%',
      overflowY: 'auto',
      padding:   '20px 20px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily:  "'Fraunces', Georgia, serif",
          fontSize:    22,
          fontWeight:  900,
          color:       T.text,
          marginBottom: 3,
        }}>
          Overview
        </h2>
        <p style={{ fontSize: 12, color: T.textSoft }}>
          All your projects and agents at a glance.
        </p>
      </div>

      {/* ── Stats grid ───────────────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap:                 10,
        marginBottom:        24,
      }}>
        <StatCard
          icon="📁"
          label="Total projects"
          value={totalProjects}
          color={T.text}
        />
        <StatCard
          icon="✅"
          label="Tasks complete"
          value={totalCount > 0 ? `${doneCount}/${totalCount}` : '—'}
          sub={totalCount > 0 ? `${pct(doneCount, totalCount)}% done` : undefined}
          color={T.green}
          bg={T.greenSoft}
        />
        <StatCard
          icon="✋"
          label="Need your input"
          value={needsInputProjects.length}
          color={needsInputProjects.length > 0 ? T.amber : T.textMid}
          bg={needsInputProjects.length > 0 ? T.amberSoft : T.surface}
        />
        <StatCard
          icon="💰"
          label="Cost today"
          value={`$${costToday.toFixed(2)}`}
          color={T.accent}
          bg={T.accentSoft}
        />
      </div>

      {/* ── Needs your input section ─────────────────────────────────── */}
      {needsInputProjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 16 }}>✋</span>
            <h3 style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize:   14,
              fontWeight: 700,
              color:      T.amber,
              margin:     0,
            }}>
              Needs your input
            </h3>
          </div>

          <div style={{
            display:  'flex',
            flexDirection: 'column',
            gap:      6,
          }}>
            {needsInputProjects.map(proj => {
              const notif = notifications.find(n =>
                !n.read && n.project_id === proj.id &&
                ['decision', 'approval', 'token-warning', 'blocker'].includes(n.type)
              )
              const wsType = proj.workspace_type || proj.workspace?.type || 'private'
              const wsInfo = WS[wsType] || WS['private']

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className="animate-fade-in"
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    padding:      '10px 14px',
                    borderRadius: 10,
                    border:       `1px solid ${T.amberBorder}`,
                    background:   T.amberSoft,
                    cursor:       'pointer',
                    transition:   'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
                  onMouseLeave={e => e.currentTarget.style.background = T.amberSoft}
                >
                  <span style={{ fontSize: 18 }}>{proj.emoji || '📁'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                      {proj.name}
                    </div>
                    {notif && (
                      <div style={{ fontSize: 11, color: T.amber, marginTop: 2 }}>
                        {notif.title || notif.message}
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding:      '3px 9px',
                    borderRadius: 999,
                    background:   wsInfo.soft,
                    color:        wsInfo.color,
                    fontSize:     10,
                    fontWeight:   700,
                    flexShrink:   0,
                  }}>
                    {wsInfo.icon} {wsInfo.label}
                  </span>
                  <span style={{ fontSize: 14, color: T.textSoft }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Workspace project sections ───────────────────────────────── */}
      {wsOrder.map(wsKey => {
        const wsProjects = projectsByWs[wsKey] || []
        if (wsProjects.length === 0) return null

        const wsInfo = WS[wsKey]

        return (
          <div key={wsKey} style={{ marginBottom: 24 }}>
            {/* Workspace heading */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              marginBottom: 10,
            }}>
              <span style={{
                width:          28,
                height:         28,
                borderRadius:   8,
                background:     wsInfo.soft,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       14,
                flexShrink:     0,
              }}>
                {wsInfo.icon}
              </span>
              <h3 style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize:   14,
                fontWeight: 700,
                color:      wsInfo.color,
                margin:     0,
              }}>
                {wsInfo.label}
              </h3>
              <span style={{ fontSize: 11, color: T.textSoft }}>
                {wsProjects.length} project{wsProjects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Project cards grid */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap:                 10,
            }}>
              {wsProjects.map(proj => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  wsInfo={wsInfo}
                  onOpenProject={onOpenProject}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {projects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: T.textSoft }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
          <div style={{
            fontFamily:  "'Fraunces', Georgia, serif",
            fontSize:    18,
            fontWeight:  700,
            color:       T.textMid,
            marginBottom: 6,
          }}>
            No projects yet
          </div>
          <div style={{ fontSize: 12 }}>
            Tell AI PM what you want to get done to create your first project.
          </div>
        </div>
      )}
    </div>
  )
}
