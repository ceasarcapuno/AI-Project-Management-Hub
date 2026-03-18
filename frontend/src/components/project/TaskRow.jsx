// ═══════════════════════════════════════════════════════════════════════════
// TaskRow — single task row in a MilestoneBlock
// Props: task, idx, projectId, onRunTask
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { T, AGENT_TYPE_INFO } from '../../utils/constants'
import StatusPill from '../ui/StatusPill'
import ModelBadge from '../ui/ModelBadge'
import FilePill   from '../ui/FilePill'

export default function TaskRow({ task, idx, projectId, onRunTask }) {
  const [showOutputs, setShowOutputs] = useState(false)
  const [running,     setRunning]     = useState(false)

  const isDone       = ['done', 'completed'].includes(task.status)
  const canRun       = ['pending', 'todo', 'waiting', 'blocked'].includes(task.status)
  const agentInfo    = AGENT_TYPE_INFO[task.assigned_agent_type] || { emoji: '🤖' }
  const outputs      = task.outputs || []
  const hasOutputs   = outputs.length > 0

  async function handleRun(e) {
    e.stopPropagation()
    if (running) return
    setRunning(true)
    try {
      await onRunTask(task.id)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div style={{
        display:      'grid',
        gridTemplateColumns: '90px 1fr 120px 90px',
        alignItems:   'center',
        gap:          8,
        padding:      '7px 12px',
        borderTop:    idx > 0 ? `1px solid ${T.borderLight}` : 'none',
        background:   T.surface,
        minHeight:    40,
      }}>
        {/* Status pill */}
        <div>
          <StatusPill status={task.status} small />
        </div>

        {/* Task name */}
        <div style={{
          fontSize:        12,
          fontWeight:      isDone ? 400 : 500,
          color:           isDone ? T.textSoft : T.text,
          textDecoration:  isDone ? 'line-through' : 'none',
          overflow:        'hidden',
          textOverflow:    'ellipsis',
          whiteSpace:      'nowrap',
          display:         'flex',
          alignItems:      'center',
          gap:             6,
        }}>
          {task.name}
        </div>

        {/* Agent type + model */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {task.assigned_agent_type && (
            <span title={task.assigned_agent_type} style={{ fontSize: 14, flexShrink: 0 }}>
              {agentInfo.emoji}
            </span>
          )}
          <span style={{
            fontSize:     10,
            color:        T.textSoft,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {task.assigned_agent_type || '—'}
          </span>
        </div>

        {/* Right side: ModelBadge, outputs badge, run button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
          {task.model && <ModelBadge model={task.model} />}

          {/* Outputs badge */}
          {hasOutputs && (
            <button
              onClick={() => setShowOutputs(o => !o)}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          3,
                padding:      '2px 7px',
                borderRadius: 999,
                border:       `1px solid ${T.greenBorder}`,
                background:   showOutputs ? T.greenSoft : T.surface,
                color:        T.green,
                fontSize:     10,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'background 0.12s',
                fontFamily:   "'DM Sans', sans-serif",
              }}
            >
              📦 {outputs.length}
            </button>
          )}

          {/* Run task button */}
          {canRun && (
            <button
              onClick={handleRun}
              disabled={running}
              title="Run task"
              style={{
                width:          26,
                height:         26,
                borderRadius:   8,
                border:         'none',
                background:     running ? T.accentBorder : T.accent,
                color:          '#fff',
                cursor:         running ? 'wait' : 'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       11,
                flexShrink:     0,
                transition:     'background 0.15s',
              }}
            >
              {running ? (
                <span style={{
                  width:        10,
                  height:       10,
                  border:       '1.5px solid rgba(255,255,255,0.4)',
                  borderTop:    '1.5px solid #fff',
                  borderRadius: '50%',
                  display:      'block',
                  animation:    'spin 0.7s linear infinite',
                }} />
              ) : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* ── Outputs dropdown ─────────────────────────────────────────── */}
      {showOutputs && hasOutputs && (
        <div
          className="animate-expand"
          style={{
            padding:    '8px 12px 10px 32px',
            background: T.greenSoft,
            borderTop:  `1px solid ${T.greenBorder}`,
            display:    'flex',
            flexDirection: 'column',
            gap:        5,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Task outputs
          </div>
          {outputs.map((file, fi) => (
            <FilePill key={file.id || fi} file={file} />
          ))}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
