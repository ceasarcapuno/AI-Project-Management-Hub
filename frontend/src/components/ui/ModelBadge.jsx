// ═══════════════════════════════════════════════════════════════════════════
// ModelBadge — shows the Claude model label with colour coding
// Props: model (string key from MODEL constant)
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { MODEL, T } from '../../utils/constants'

export default function ModelBadge({ model }) {
  if (!model) return null

  const m = MODEL[model] || {
    label: model,
    color: T.textSoft,
    bg:    '#f5f4f2',
  }

  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      padding:      '2px 8px',
      borderRadius: 999,
      background:   m.bg,
      color:        m.color,
      fontSize:     10,
      fontWeight:   700,
      whiteSpace:   'nowrap',
      letterSpacing: '0.02em',
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      {m.label}
    </span>
  )
}
