// ═══════════════════════════════════════════════════════════════════════════
// StatusPill — task/milestone status badge
// Props: status (string), small (bool)
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { TASK_STATUS, T } from '../../utils/constants'

export default function StatusPill({ status, small }) {
  const s = TASK_STATUS[status] || {
    label:  status || 'Unknown',
    color:  T.textSoft,
    bg:     '#f5f4f2',
    border: T.border,
    icon:   '○',
  }

  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          small ? 3 : 4,
      padding:      small ? '2px 7px' : '3px 9px',
      borderRadius: 999,
      background:   s.bg,
      border:       `1px solid ${s.border}`,
      color:        s.color,
      fontSize:     small ? 10 : 11,
      fontWeight:   600,
      whiteSpace:   'nowrap',
      lineHeight:   1.4,
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      <span style={{ fontSize: small ? 8 : 9 }}>{s.icon}</span>
      {s.label}
    </span>
  )
}
