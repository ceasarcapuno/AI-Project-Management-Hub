// ═══════════════════════════════════════════════════════════════════════════
// MilestoneBlock — collapsible milestone section with task rows
// Props: milestone = { id, name, status, tasks: [] }, projectId, onRunTask
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { T } from '../../utils/constants'
import { pct } from '../../utils/helpers'
import StatusPill from '../ui/StatusPill'
import TaskRow    from './TaskRow'

export default function MilestoneBlock({ milestone, projectId, onRunTask }) {
  // Default open for ongoing/in_progress milestones
  const defaultOpen = ['ongoing', 'in_progress'].includes(milestone.status)
  const [open, setOpen] = useState(defaultOpen)

  const tasks     = milestone.tasks || []
  const doneTasks = tasks.filter(t => ['done', 'completed'].includes(t.status)).length
  const total     = tasks.length
  const progress  = pct(doneTasks, total)

  // Status colour mapping for the milestone header
  const statusColors = {
    done:        { bar: T.green,   bg: T.greenSoft,   border: T.greenBorder },
    completed:   { bar: T.green,   bg: T.greenSoft,   border: T.greenBorder },
    ongoing:     { bar: T.accent,  bg: T.accentSoft,  border: T.accentBorder },
    in_progress: { bar: T.accent,  bg: T.accentSoft,  border: T.accentBorder },
    blocked:     { bar: T.amber,   bg: T.amberSoft,   border: T.amberBorder },
    pending:     { bar: T.textSoft, bg: '#f5f4f2',    border: T.border },
    todo:        { bar: T.textSoft, bg: '#f5f4f2',    border: T.border },
  }
  const sc = statusColors[milestone.status] || statusColors['pending']

  return (
    <div
      className="animate-fade-in"
      style={{
        borderRadius: 12,
        border:       `1px solid ${sc.border}`,
        background:   T.surface,
        overflow:     'hidden',
        marginBottom: 10,
        fontFamily:   "'DM Sans', sans-serif",
      }}
    >
      {/* ── Milestone header ─────────────────────────────────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          padding:        '10px 14px',
          cursor:         'pointer',
          background:     sc.bg,
          borderBottom:   open ? `1px solid ${sc.border}` : 'none',
          userSelect:     'none',
        }}
      >
        {/* Chevron */}
        <span style={{
          fontSize:   11,
          color:      T.textSoft,
          transform:  open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease',
          flexShrink: 0,
          lineHeight: 1,
        }}>
          ▶
        </span>

        {/* Milestone name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize:     13,
            fontWeight:   700,
            color:        T.text,
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            overflow:     'hidden',
          }}>
            <span style={{
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              🏁 {milestone.name}
            </span>
            <StatusPill status={milestone.status} small />
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
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
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 10, color: T.textSoft, whiteSpace: 'nowrap' }}>
                {doneTasks}/{total} tasks
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Task list ────────────────────────────────────────────────── */}
      {open && (
        <div className="animate-expand">
          {/* Column headers */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '90px 1fr 120px 90px',
            gap:                 8,
            padding:             '5px 12px',
            background:          T.bg,
            borderBottom:        `1px solid ${T.borderLight}`,
          }}>
            {['Status', 'Task', 'Agent', ''].map((h, i) => (
              <div key={i} style={{
                fontSize:   9,
                fontWeight: 700,
                color:      T.textSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Task rows */}
          {tasks.length === 0 ? (
            <div style={{
              padding:    '20px',
              textAlign:  'center',
              color:      T.textSoft,
              fontSize:   12,
            }}>
              No tasks yet
            </div>
          ) : (
            tasks.map((task, idx) => (
              <TaskRow
                key={task.id || idx}
                task={task}
                idx={idx}
                projectId={projectId}
                onRunTask={onRunTask}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
