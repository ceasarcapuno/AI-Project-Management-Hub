// ═══════════════════════════════════════════════════════════════════════════
// NotificationPanel — slide-in notification panel
// Props: notifications, onDismiss(id), onAction(id, action)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { T, NOTIF_ICONS } from '../../utils/constants'
import { fmtDate } from '../../utils/helpers'
import TokenBar from '../ui/TokenBar'

// ─── Filter pill definitions ──────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'unread',    label: 'Unread'    },
  { key: 'urgent',    label: 'Urgent'    },
  { key: 'token',     label: 'Token'     },
  { key: 'approval',  label: 'Approval'  },
  { key: 'decision',  label: 'Decision'  },
  { key: 'cost',      label: 'Cost'      },
]

// ─── Single notification card ─────────────────────────────────────────────────
function NotifCard({ notif, onDismiss, onAction }) {
  const [expanded, setExpanded] = useState(false)

  const typeKey = notif.type || 'system'
  const def     = NOTIF_ICONS[typeKey] || NOTIF_ICONS['system']

  const isUrgent = ['token-warning', 'decision', 'approval', 'blocker', 'deadline'].includes(typeKey)

  // Token data if present
  const tokens = notif.metadata?.tokens_used
  const tokenLimit = notif.metadata?.token_limit

  // Action buttons from metadata
  const actions = notif.metadata?.actions || []

  return (
    <div
      className="animate-fade-in"
      style={{
        borderRadius: 12,
        border:       `1px solid ${notif.read ? T.border : def.border}`,
        background:   notif.read ? T.surface : def.bg,
        marginBottom: 8,
        overflow:     'hidden',
        transition:   'border-color 0.15s, background 0.15s',
        fontFamily:   "'DM Sans', sans-serif",
      }}
    >
      {/* ── Card header ─────────────────────────────────────────────── */}
      <div
        style={{
          padding:  '10px 12px',
          display:  'flex',
          gap:      10,
          cursor:   'pointer',
          alignItems: 'flex-start',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Icon */}
        <div style={{
          width:          34,
          height:         34,
          borderRadius:   9,
          background:     def.bg,
          border:         `1px solid ${def.border}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       16,
          flexShrink:     0,
        }}>
          {def.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type label + unread dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize:   10,
              fontWeight: 700,
              color:      def.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {def.label}
            </span>
            {!notif.read && (
              <span style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   isUrgent ? T.red : T.accent,
                flexShrink:   0,
              }} />
            )}
            {isUrgent && (
              <span style={{
                fontSize:   9,
                fontWeight: 700,
                color:      T.red,
                background: T.redSoft,
                border:     `1px solid ${T.redBorder}`,
                borderRadius: 999,
                padding:    '1px 5px',
              }}>
                Urgent
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize:   12,
            fontWeight: notif.read ? 500 : 700,
            color:      T.text,
            lineHeight: 1.3,
          }}>
            {notif.title || notif.message || 'Notification'}
          </div>

          {/* Time */}
          <div style={{ fontSize: 10, color: T.textSoft, marginTop: 3 }}>
            {fmtDate(notif.created_at)}
            {notif.project_name && (
              <span> · {notif.project_name}</span>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={e => { e.stopPropagation(); onDismiss(notif.id) }}
          style={{
            width:          20,
            height:         20,
            borderRadius:   '50%',
            border:         'none',
            background:     'transparent',
            cursor:         'pointer',
            color:          T.textSoft,
            fontSize:       12,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}
          title="Dismiss"
        >
          ×
        </button>
      </div>

      {/* ── Expanded detail ──────────────────────────────────────────── */}
      {expanded && (
        <div
          className="animate-expand"
          style={{
            padding:    '0 12px 12px',
            borderTop:  `1px solid ${def.border}`,
            paddingTop: 10,
          }}
        >
          {/* Body text */}
          {notif.body && (
            <p style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5, marginBottom: 10 }}>
              {notif.body}
            </p>
          )}

          {/* Token bar if applicable */}
          {tokens != null && tokenLimit != null && (
            <div style={{ marginBottom: 10 }}>
              <TokenBar used={tokens} limit={tokenLimit} />
            </div>
          )}

          {/* Action buttons */}
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction(notif.id, action)}
                  style={{
                    padding:      '5px 12px',
                    borderRadius: 8,
                    border:       i === 0 ? 'none' : `1px solid ${T.border}`,
                    background:   i === 0 ? T.accent : T.surface,
                    color:        i === 0 ? '#fff' : T.textMid,
                    fontSize:     11,
                    fontWeight:   600,
                    cursor:       'pointer',
                    fontFamily:   "'DM Sans', sans-serif",
                  }}
                >
                  {action.label || action}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── NotificationPanel ────────────────────────────────────────────────────────
export default function NotificationPanel({ notifications = [], onDismiss, onAction }) {
  const [filter,      setFilter]      = useState('all')
  const [markingAll,  setMarkingAll]  = useState(false)

  // Filter notifications
  const filtered = useMemo(() => {
    if (filter === 'all')      return notifications
    if (filter === 'unread')   return notifications.filter(n => !n.read)
    if (filter === 'urgent')   return notifications.filter(n =>
      ['token-warning', 'decision', 'approval', 'blocker', 'deadline'].includes(n.type)
    )
    if (filter === 'token')    return notifications.filter(n => n.type === 'token-warning')
    if (filter === 'approval') return notifications.filter(n => n.type === 'approval')
    if (filter === 'decision') return notifications.filter(n => n.type === 'decision')
    if (filter === 'cost')     return notifications.filter(n => ['cost-alert', 'cost'].includes(n.type))
    return notifications
  }, [notifications, filter])

  const unreadCount = notifications.filter(n => !n.read).length

  async function handleMarkAll() {
    if (markingAll) return
    setMarkingAll(true)
    try {
      // Calls onAction with special 'mark-all-read' signal
      await onAction('all', 'mark-all-read')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      fontFamily:    "'DM Sans', sans-serif",
      background:    T.bg,
    }}>
      {/* ── Panel header ───────────────────────────────────────────── */}
      <div style={{
        padding:      '16px 16px 12px',
        borderBottom: `1px solid ${T.border}`,
        background:   T.surface,
        flexShrink:   0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🔔</span>
            <span style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize:   16,
              fontWeight: 700,
              color:      T.text,
            }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                padding:      '2px 7px',
                borderRadius: 999,
                background:   T.accent,
                color:        '#fff',
                fontSize:     10,
                fontWeight:   700,
              }}>
                {unreadCount} new
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              style={{
                fontSize:   11,
                fontWeight: 600,
                color:      T.accent,
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                padding:    '2px 6px',
                borderRadius: 6,
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding:      '3px 10px',
                borderRadius: 999,
                border:       `1px solid ${filter === f.key ? T.accent : T.border}`,
                background:   filter === f.key ? T.accent : T.surface,
                color:        filter === f.key ? '#fff' : T.textMid,
                fontSize:     10,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'background 0.12s, border-color 0.12s',
                fontFamily:   "'DM Sans', sans-serif",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification list ───────────────────────────────────────── */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        padding:    '12px 12px',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign:  'center',
            padding:    '48px 0',
            color:      T.textSoft,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>All clear!</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>No {filter !== 'all' ? filter + ' ' : ''}notifications</div>
          </div>
        ) : (
          filtered.map(notif => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onDismiss={onDismiss}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </div>
  )
}
