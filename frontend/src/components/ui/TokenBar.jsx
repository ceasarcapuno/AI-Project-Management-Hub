// ═══════════════════════════════════════════════════════════════════════════
// TokenBar — token usage progress bar with colour coding
// Props: used (number), limit (number)
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { T } from '../../utils/constants'
import { pct, tokenColor, tokenBg, tokenBorder } from '../../utils/helpers'

export default function TokenBar({ used = 0, limit = 200000 }) {
  const usedPct  = pct(used, limit)
  const barColor = tokenColor(usedPct)
  const bgColor  = tokenBg(usedPct)
  const border   = tokenBorder(usedPct)

  // Format token counts
  function fmtTokens(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
    return String(n)
  }

  return (
    <div style={{ width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Label row */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   4,
      }}>
        <span style={{ fontSize: 11, color: T.textSoft }}>
          Tokens used
        </span>
        <span style={{
          fontSize:   11,
          fontWeight: 600,
          color:      barColor,
          background: bgColor,
          border:     `1px solid ${border}`,
          borderRadius: 999,
          padding:    '1px 7px',
        }}>
          {fmtTokens(used)} / {fmtTokens(limit)} ({usedPct}%)
        </span>
      </div>

      {/* Bar track */}
      <div style={{
        width:        '100%',
        height:       5,
        background:   '#ece9e4',
        borderRadius: 999,
        overflow:     'hidden',
      }}>
        <div style={{
          width:        `${Math.min(usedPct, 100)}%`,
          height:       '100%',
          background:   barColor,
          borderRadius: 999,
          transition:   'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}
