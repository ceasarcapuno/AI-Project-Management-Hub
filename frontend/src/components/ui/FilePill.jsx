// ═══════════════════════════════════════════════════════════════════════════
// FilePill — file attachment chip with icon, name, size, type badge, download
// Props: file = { id?, name, file_size (bytes) or kb, created_at or time, storage_path? }
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { T } from '../../utils/constants'
import { fileTypeOf, fmtBytes, fmtSize, fmtDate, downloadOutput, downloadBlob } from '../../utils/helpers'

export default function FilePill({ file }) {
  if (!file) return null

  const name    = file.name || file.filename || 'Untitled'
  const ft      = fileTypeOf(name)
  const sizeStr = file.file_size != null
    ? fmtBytes(file.file_size)
    : file.kb != null
      ? fmtSize(file.kb)
      : ''
  const timeStr = file.created_at ? fmtDate(file.created_at) : file.time || ''

  async function handleDownload(e) {
    e.stopPropagation()
    if (file.id) {
      await downloadOutput(file.id, name)
    } else {
      downloadBlob(name, '')
    }
  }

  return (
    <div
      onClick={handleDownload}
      title={`Download ${name}`}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '7px 10px',
        borderRadius: 10,
        background:   T.bg,
        border:       `1px solid ${T.border}`,
        cursor:       'pointer',
        transition:   'background 0.15s',
        fontFamily:   "'DM Sans', sans-serif",
        minWidth:     0,
      }}
      onMouseEnter={e => e.currentTarget.style.background = T.accentSoft}
      onMouseLeave={e => e.currentTarget.style.background = T.bg}
    >
      {/* File icon */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>{ft.icon}</span>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:     12,
          fontWeight:   600,
          color:        T.text,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: T.textSoft, marginTop: 1 }}>
          {[sizeStr, timeStr].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Type badge */}
      <span style={{
        flexShrink:   0,
        fontSize:     9,
        fontWeight:   700,
        padding:      '2px 6px',
        borderRadius: 6,
        background:   ft.bg,
        color:        ft.color,
        letterSpacing: '0.03em',
      }}>
        {ft.label}
      </span>

      {/* Download arrow */}
      <span style={{
        flexShrink: 0,
        fontSize:   13,
        color:      T.textSoft,
        marginLeft: 2,
      }}>
        ↓
      </span>
    </div>
  )
}
