// ═══════════════════════════════════════════════════════════════════════════
// ProjectDetail — full project view with header, tabs, and content
// Props: project, milestones, tasks, agents, outputs, threadMessages,
//        onRunTask, onSendMessage, sending, notifications
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { T, WS, TASK_STATUS } from '../../utils/constants'
import { pct, fmtDueDate, tokenColor, tokenBg, tokenBorder } from '../../utils/helpers'
import MilestoneBlock from './MilestoneBlock'
import CommsPanel     from './CommsPanel'
import OutputsTab     from './OutputsTab'

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'milestones', label: '🗂 Milestones & Tasks' },
  { key: 'thread',     label: '💬 Team Thread'        },
  { key: 'outputs',    label: '📦 Outputs'            },
]

export default function ProjectDetail({
  project,
  milestones    = [],
  tasks         = [],
  agents        = [],
  outputs       = [],
  threadMessages = [],
  onRunTask,
  onSendMessage,
  sending,
  notifications = [],
}) {
  const [activeTab, setActiveTab] = useState('milestones')

  if (!project) return null

  // ─── Workspace info ─────────────────────────────────────────────────────────
  const wsType = project.workspace_type || project.workspace?.type || 'private'
  const wsInfo = WS[wsType] || WS['private']

  // ─── Progress ───────────────────────────────────────────────────────────────
  const doneTasks  = tasks.filter(t => ['done', 'completed'].includes(t.status)).length
  const totalTasks = tasks.length
  const progress   = pct(doneTasks, totalTasks)

  // ─── Token usage ────────────────────────────────────────────────────────────
  const tokensUsed  = project.tokens_used  || 0
  const tokenLimit  = project.token_limit  || 200000
  const tokenPct    = pct(tokensUsed, tokenLimit)
  const tkColor     = tokenColor(tokenPct)
  const tkBg        = tokenBg(tokenPct)
  const tkBorder    = tokenBorder(tokenPct)

  // ─── Cost ────────────────────────────────────────────────────────────────────
  const cost = project.total_cost || project.cost || 0
  const costStr = `$${cost.toFixed(2)}`

  // ─── "Needs you" banner — from urgent/decision/approval notifications ────────
  const needsYouNotif = notifications.find(n =>
    !n.read &&
    ['decision', 'approval'].includes(n.type) &&
    n.project_id === project.id
  )

  // ─── Employer note (work workspace) ─────────────────────────────────────────
  const employerNote = wsType === 'work' && project.employer_note

  // ─── Milestone list with nested tasks ───────────────────────────────────────
  const milestonesWithTasks = useMemo(() =>
    milestones.map(m => ({
      ...m,
      tasks: tasks.filter(t => t.milestone_id === m.id),
    })),
    [milestones, tasks]
  )

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      overflow:      'hidden',
      fontFamily:    "'DM Sans', sans-serif",
    }}>
      {/* ── Project header ──────────────────────────────────────────── */}
      <div style={{
        padding:      '16px 20px 14px',
        borderBottom: `1px solid ${T.border}`,
        background:   T.surface,
        flexShrink:   0,
      }}>
        {/* Top row: emoji + name + workspace badge + due date */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          {/* Emoji */}
          <div style={{
            width:          44,
            height:         44,
            borderRadius:   12,
            background:     wsInfo.soft,
            border:         `1.5px solid ${wsInfo.color}30`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       22,
            flexShrink:     0,
          }}>
            {project.emoji || '📁'}
          </div>

          {/* Name + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{
                fontFamily:  "'Fraunces', Georgia, serif",
                fontSize:    18,
                fontWeight:  900,
                color:       T.text,
                lineHeight:  1.2,
                margin:      0,
              }}>
                {project.name}
              </h1>

              {/* Workspace badge */}
              <span style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          4,
                padding:      '2px 8px',
                borderRadius: 999,
                background:   wsInfo.soft,
                color:        wsInfo.color,
                fontSize:     10,
                fontWeight:   700,
                border:       `1px solid ${wsInfo.color}30`,
              }}>
                {wsInfo.icon} {wsInfo.label}
              </span>

              {/* Due date */}
              {project.due_date && (
                <span style={{
                  fontSize:   11,
                  color:      T.textSoft,
                  display:    'flex',
                  alignItems: 'center',
                  gap:        4,
                }}>
                  📅 Due {fmtDueDate(project.due_date)}
                </span>
              )}

              {/* Token badge */}
              {tokensUsed > 0 && (
                <span style={{
                  padding:      '2px 8px',
                  borderRadius: 999,
                  background:   tkBg,
                  border:       `1px solid ${tkBorder}`,
                  color:        tkColor,
                  fontSize:     10,
                  fontWeight:   700,
                }}>
                  🔋 {tokenPct}% tokens
                </span>
              )}

              {/* Cost badge */}
              {cost > 0 && (
                <span style={{
                  padding:      '2px 8px',
                  borderRadius: 999,
                  background:   T.accentSoft,
                  border:       `1px solid ${T.accentBorder}`,
                  color:        T.accent,
                  fontSize:     10,
                  fontWeight:   700,
                }}>
                  💰 {costStr}
                </span>
              )}
            </div>

            {/* Goal */}
            {project.goal && (
              <p style={{
                fontSize:   12,
                color:      T.textMid,
                margin:     '5px 0 0',
                lineHeight: 1.4,
              }}>
                {project.goal}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex:         1,
              height:       5,
              background:   '#ece9e4',
              borderRadius: 999,
              overflow:     'hidden',
            }}>
              <div style={{
                width:      `${progress}%`,
                height:     '100%',
                background: progress === 100 ? T.green : T.accent,
                borderRadius: 999,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap' }}>
              {doneTasks}/{totalTasks} tasks · {progress}%
            </span>
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        gap:          2,
        padding:      '10px 16px 0',
        borderBottom: `1px solid ${T.border}`,
        background:   T.surface,
        flexShrink:   0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding:      '7px 14px',
              borderRadius: '8px 8px 0 0',
              border:       'none',
              background:   activeTab === tab.key ? T.bg : 'transparent',
              color:        activeTab === tab.key ? T.accent : T.textMid,
              fontSize:     12,
              fontWeight:   activeTab === tab.key ? 700 : 500,
              cursor:       'pointer',
              borderBottom: activeTab === tab.key ? `2px solid ${T.accent}` : '2px solid transparent',
              transition:   'background 0.12s, color 0.12s',
              fontFamily:   "'DM Sans', sans-serif",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ── Milestones & Tasks tab ─── */}
        {activeTab === 'milestones' && (
          <div style={{
            flex:      1,
            overflowY: 'auto',
            padding:   '16px',
          }}>
            {/* Needs you banner */}
            {needsYouNotif && (
              <div
                className="animate-fade-in"
                style={{
                  padding:      '10px 14px',
                  borderRadius: 10,
                  background:   T.amberSoft,
                  border:       `1px solid ${T.amberBorder}`,
                  marginBottom: 14,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                }}
              >
                <span style={{ fontSize: 18 }}>✋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 2 }}>
                    Your input needed
                  </div>
                  <div style={{ fontSize: 11, color: T.text }}>
                    {needsYouNotif.title || needsYouNotif.message || 'AI PM is waiting for your decision.'}
                  </div>
                </div>
              </div>
            )}

            {/* Employer note */}
            {employerNote && (
              <div
                className="animate-fade-in"
                style={{
                  padding:      '10px 14px',
                  borderRadius: 10,
                  background:   '#f5f3ff',
                  border:       '1px solid #ddd6fe',
                  marginBottom: 14,
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          8,
                }}
              >
                <span style={{ fontSize: 15 }}>🏢</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Employer note
                  </div>
                  <p style={{ fontSize: 12, color: T.text, margin: 0, lineHeight: 1.5 }}>
                    {employerNote}
                  </p>
                </div>
              </div>
            )}

            {/* Milestone blocks */}
            {milestonesWithTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: T.textSoft }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🗂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>No milestones yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  Ask AI PM to plan this project and milestones will appear here.
                </div>
              </div>
            ) : (
              milestonesWithTasks.map(m => (
                <MilestoneBlock
                  key={m.id}
                  milestone={m}
                  projectId={project.id}
                  onRunTask={onRunTask}
                />
              ))
            )}
          </div>
        )}

        {/* ── Team Thread tab ─── */}
        {activeTab === 'thread' && (
          <CommsPanel
            project={project}
            threadMessages={threadMessages}
            onSendMessage={onSendMessage}
            sending={sending}
          />
        )}

        {/* ── Outputs tab ─── */}
        {activeTab === 'outputs' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <OutputsTab project={project} outputs={outputs} />
          </div>
        )}
      </div>
    </div>
  )
}
