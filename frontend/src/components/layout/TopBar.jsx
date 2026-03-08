// ═══════════════════════════════════════════════════════════════════════════
// TopBar — top navigation bar with breadcrumb, notifications, user avatar
// Props: isMobile, onMenuClick, breadcrumb { ws, project, isTeam },
//        onNotifClick, showNotifs, unreadCount, urgentCount, user
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { T, WS } from '../../utils/constants'
import Avatar from '../ui/Avatar'

export default function TopBar({
  isMobile,
  onMenuClick,
  breadcrumb = {},
  onNotifClick,
  showNotifs,
  unreadCount  = 0,
  urgentCount  = 0,
  user,
}) {
  const { ws, project, isTeam } = breadcrumb

  // Build breadcrumb segments
  const wsInfo = ws ? (WS[ws.type] || WS[ws.workspace_type] || null) : null

  // User display name / initial
  const userName  = user?.user_metadata?.display_name || user?.email || 'U'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <header style={{
      height:       52,
      flexShrink:   0,
      background:   T.surface,
      borderBottom: `1px solid ${T.border}`,
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '0 16px',
      fontFamily:   "'DM Sans', sans-serif",
      zIndex:       20,
    }}>
      {/* ── Mobile hamburger ────────────────────────────────────────── */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={{
            width:        36,
            height:       36,
            borderRadius: 8,
            border:       `1px solid ${T.border}`,
            background:   T.bg,
            cursor:       'pointer',
            display:      'flex',
            flexDirection: 'column',
            alignItems:   'center',
            justifyContent: 'center',
            gap:          4,
            flexShrink:   0,
          }}
        >
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 14, height: 1.5, background: T.textMid, borderRadius: 1 }} />
          ))}
        </button>
      )}

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div style={{
        flex:       1,
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        minWidth:   0,
        overflow:   'hidden',
      }}>
        {/* Overview */}
        <span style={{ fontSize: 12, color: T.textSoft, whiteSpace: 'nowrap' }}>
          Overview
        </span>

        {/* Workspace segment */}
        {wsInfo && (
          <>
            <span style={{ color: T.borderLight, fontSize: 12 }}>›</span>
            <span style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          5,
              padding:      '2px 8px',
              borderRadius: 999,
              background:   wsInfo.soft || T.bg,
              fontSize:     11,
              fontWeight:   600,
              color:        wsInfo.color,
              whiteSpace:   'nowrap',
            }}>
              <span>{wsInfo.icon}</span>
              {wsInfo.label}
            </span>
          </>
        )}

        {/* Team segment */}
        {isTeam && (
          <>
            <span style={{ color: T.borderLight, fontSize: 12 }}>›</span>
            <span style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          5,
              padding:      '2px 8px',
              borderRadius: 999,
              background:   T.accentSoft,
              fontSize:     11,
              fontWeight:   600,
              color:        T.accent,
            }}>
              🤖 All Agents
            </span>
          </>
        )}

        {/* Project segment */}
        {project && (
          <>
            <span style={{ color: T.borderLight, fontSize: 12 }}>›</span>
            <span style={{
              fontSize:     12,
              fontWeight:   600,
              color:        T.text,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {project.emoji || '📁'} {project.name}
            </span>
          </>
        )}
      </div>

      {/* ── Right side — notifications + avatar ─────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Notification bell */}
        <button
          onClick={onNotifClick}
          title="Notifications"
          style={{
            position:     'relative',
            width:        36,
            height:       36,
            borderRadius: 8,
            border:       showNotifs
              ? `1.5px solid ${T.accentBorder}`
              : `1px solid ${T.border}`,
            background:   showNotifs ? T.accentSoft : T.bg,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     16,
            transition:   'background 0.15s, border-color 0.15s',
          }}
        >
          🔔
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span style={{
              position:     'absolute',
              top:          -5,
              right:        -5,
              minWidth:     17,
              height:       17,
              borderRadius: 999,
              background:   urgentCount > 0 ? T.red : T.accent,
              color:        '#fff',
              fontSize:     9,
              fontWeight:   700,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              padding:      '0 4px',
              border:       `2px solid ${T.surface}`,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <Avatar char={userInitial} size={32} />
      </div>
    </header>
  )
}
