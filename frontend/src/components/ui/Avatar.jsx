// ═══════════════════════════════════════════════════════════════════════════
// Avatar — single-char avatar circle
// Props: char (string), size (number, default 28)
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { T } from '../../utils/constants'

export default function Avatar({ char = '?', size = 28 }) {
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   '50%',
      background:     T.accentSoft,
      border:         `1.5px solid ${T.accentBorder}`,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       size * 0.42,
      fontWeight:     700,
      color:          T.accent,
      flexShrink:     0,
      fontFamily:     "'DM Sans', sans-serif",
      userSelect:     'none',
    }}>
      {String(char).charAt(0).toUpperCase()}
    </div>
  )
}
