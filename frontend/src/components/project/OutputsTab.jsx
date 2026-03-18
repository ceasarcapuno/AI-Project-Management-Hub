// ═══════════════════════════════════════════════════════════════════════════
// OutputsTab — outputs browser for a project
// Props: project, outputs (array from API)
//
// Output shape: { id, filename, file_type, file_size, created_at,
//                 task_name, agent_name, milestone_name, task_status }
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { T, FILE_TYPE } from '../../utils/constants'
import { fileTypeOf, fmtBytes, fmtDate, downloadOutput } from '../../utils/helpers'

// ─── Stats card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon }) {
  return (
    <div style={{
      padding:      '12px 14px',
      borderRadius: 10,
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      display:      'flex',
      flexDirection: 'column',
      gap:          3,
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textSoft }}>{label}</div>
    </div>
  )
}

// ─── File row ─────────────────────────────────────────────────────────────────
function FileRow({ output }) {
  const name    = output.filename || output.name || 'file'
  const ft      = fileTypeOf(name)
  const sizeStr = output.file_size != null ? fmtBytes(output.file_size) : ''
  const timeStr = fmtDate(output.created_at)

  async function handleDownload() {
    await downloadOutput(output.id, name)
  }

  return (
    <div
      onClick={handleDownload}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '8px 12px',
        borderBottom: `1px solid ${T.borderLight}`,
        cursor:       'pointer',
        transition:   'background 0.12s',
        fontFamily:   "'DM Sans', sans-serif",
      }}
      onMouseEnter={e => e.currentTarget.style.background = T.accentSoft}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      title={`Download ${name}`}
    >
      {/* Icon */}
      <span style={{ fontSize: 20, flexShrink: 0 }}>{ft.icon}</span>

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
        <div style={{ fontSize: 10, color: T.textSoft, marginTop: 2 }}>
          {[output.task_name, output.agent_name, timeStr].filter(Boolean).join(' · ')}
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

      {/* Size */}
      {sizeStr && (
        <span style={{ fontSize: 10, color: T.textSoft, flexShrink: 0 }}>
          {sizeStr}
        </span>
      )}

      {/* Download arrow */}
      <span style={{ fontSize: 14, color: T.textSoft, flexShrink: 0 }}>↓</span>
    </div>
  )
}

// ─── OutputsTab ───────────────────────────────────────────────────────────────
export default function OutputsTab({ project, outputs = [] }) {
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Compute stats
  const totalSize = useMemo(() =>
    outputs.reduce((s, o) => s + (o.file_size || 0), 0),
    [outputs]
  )

  const fileTypes = useMemo(() => {
    const types = new Set(outputs.map(o => {
      const ext = (o.filename || '').split('.').pop().toLowerCase()
      return ext || 'other'
    }))
    return ['all', ...Array.from(types)]
  }, [outputs])

  const agents = useMemo(() => {
    const set = new Set(outputs.map(o => o.agent_name).filter(Boolean))
    return set.size
  }, [outputs])

  // Filter outputs
  const filtered = useMemo(() => {
    let res = outputs
    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(o =>
        (o.filename || '').toLowerCase().includes(q) ||
        (o.task_name || '').toLowerCase().includes(q) ||
        (o.agent_name || '').toLowerCase().includes(q) ||
        (o.milestone_name || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') {
      res = res.filter(o => {
        const ext = (o.filename || '').split('.').pop().toLowerCase()
        return ext === typeFilter
      })
    }
    return res
  }, [outputs, search, typeFilter])

  // Group by milestone
  const byMilestone = useMemo(() => {
    const map = new Map()
    filtered.forEach(o => {
      const key = o.milestone_name || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(o)
    })
    return Array.from(map.entries())
  }, [filtered])

  async function handleBulkDownload() {
    for (const output of filtered) {
      await downloadOutput(output.id, output.filename || output.name || 'file')
    }
  }

  function fmtBytesLarge(b) {
    if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`
    if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`
    if (b >= 1024)          return `${(b / 1024).toFixed(1)} KB`
    return `${b} B`
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           16,
      fontFamily:    "'DM Sans', sans-serif",
    }}>
      {/* ── Stats row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <StatCard icon="📦" label="Total outputs" value={outputs.length} />
        <StatCard icon="💾" label="Total size" value={fmtBytesLarge(totalSize)} />
        <StatCard icon="🗂" label="File types" value={fileTypes.length - 1} />
        <StatCard icon="🤖" label="Agents" value={agents} />
      </div>

      {/* ── Search + filters ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search outputs…"
          style={{
            padding:      '7px 12px',
            borderRadius: 9,
            border:       `1.5px solid ${T.border}`,
            background:   T.surface,
            fontSize:     12,
            color:        T.text,
            fontFamily:   "'DM Sans', sans-serif",
            minWidth:     200,
          }}
        />

        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {fileTypes.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding:      '4px 10px',
                borderRadius: 999,
                border:       `1px solid ${typeFilter === t ? T.accent : T.border}`,
                background:   typeFilter === t ? T.accent : T.surface,
                color:        typeFilter === t ? '#fff' : T.textMid,
                fontSize:     10,
                fontWeight:   600,
                cursor:       'pointer',
                textTransform: t === 'all' ? 'none' : 'uppercase',
                fontFamily:   "'DM Sans', sans-serif",
              }}
            >
              {t === 'all' ? 'All files' : t}
            </button>
          ))}
        </div>

        {/* Bulk download */}
        {filtered.length > 0 && (
          <button
            onClick={handleBulkDownload}
            style={{
              marginLeft:   'auto',
              padding:      '6px 14px',
              borderRadius: 8,
              border:       `1px solid ${T.border}`,
              background:   T.surface,
              color:        T.textMid,
              fontSize:     11,
              fontWeight:   600,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          5,
              fontFamily:   "'DM Sans', sans-serif",
            }}
          >
            ↓ Download all ({filtered.length})
          </button>
        )}
      </div>

      {/* ── File list grouped by milestone ──────────────────────────── */}
      {byMilestone.length === 0 ? (
        <div style={{
          textAlign:  'center',
          padding:    '48px 0',
          color:      T.textSoft,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>
            {outputs.length === 0 ? 'No outputs yet' : 'No results found'}
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            {outputs.length === 0
              ? 'Agent outputs will appear here once tasks complete.'
              : 'Try adjusting your search or filter.'}
          </div>
        </div>
      ) : (
        byMilestone.map(([milestoneName, files]) => (
          <div key={milestoneName} style={{
            borderRadius: 12,
            border:       `1px solid ${T.border}`,
            background:   T.surface,
            overflow:     'hidden',
          }}>
            {/* Milestone header */}
            <div style={{
              padding:      '8px 12px',
              background:   T.bg,
              borderBottom: `1px solid ${T.border}`,
              display:      'flex',
              alignItems:   'center',
              gap:          6,
            }}>
              <span style={{ fontSize: 13 }}>🏁</span>
              <span style={{
                fontSize:   11,
                fontWeight: 700,
                color:      T.textMid,
              }}>
                {milestoneName}
              </span>
              <span style={{
                fontSize:   10,
                color:      T.textSoft,
                marginLeft: 'auto',
              }}>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* File rows */}
            {files.map(output => (
              <FileRow key={output.id} output={output} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
