// ═══════════════════════════════════════════════════════════════════════════
// CommsPanel — project team thread / communications panel
// Props: project, threadMessages, onSendMessage, sending
//
// Message shape: { id, from_name, from_type ('aipm'|'agent'|'user'),
//                  type, content, deliverables (JSON array),
//                  metadata (JSON), created_at }
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import { T } from '../../utils/constants'
import { fmtDate } from '../../utils/helpers'
import FilePill from '../ui/FilePill'

// ─── Thinking dots animation ───────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width:        7,
          height:       7,
          borderRadius: '50%',
          background:   T.accent,
          display:      'inline-block',
          animation:    `thinking 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ─── Parse markdown bullets to list items ─────────────────────────────────────
function parseBullets(content = '') {
  const lines = content.split('\n').filter(l => l.trim())
  return lines.map(l => l.replace(/^[-*•]\s*/, ''))
}

// ─── Message bubble renderer ──────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const { from_type, from_name, type, content, deliverables, metadata, created_at } = msg

  const isUser   = from_type === 'user'
  const isAipm   = from_type === 'aipm'
  const isAgent  = from_type === 'agent'
  const isBriefing = isAipm && type === 'briefing'
  const isAlert    = isAipm && type === 'alert'
  const isReport   = isAgent || type === 'report'
  const isNatural  = isAipm && (type === 'prose' || type === 'natural')

  // ── User message ────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={{
          maxWidth:     '72%',
          padding:      '9px 13px',
          borderRadius: '14px 14px 4px 14px',
          background:   T.accent,
          color:        '#fff',
          fontSize:     12,
          lineHeight:   1.55,
          fontFamily:   "'DM Sans', sans-serif",
          whiteSpace:   'pre-wrap',
          wordBreak:    'break-word',
        }}>
          {content}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'right' }}>
            {from_name || 'You'} · {fmtDate(created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Briefing — bullet list ──────────────────────────────────────────────────
  if (isBriefing) {
    const bullets = parseBullets(content)
    return (
      <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>🤖</div>
        <div style={{
          maxWidth:     '82%',
          padding:      '10px 14px',
          borderRadius: '4px 14px 14px 14px',
          background:   T.accentSoft,
          border:       `1px solid ${T.accentBorder}`,
          fontFamily:   "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI PM Briefing
          </div>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 3 }}>
                {b}
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 9, color: T.textSoft, marginTop: 6 }}>
            {from_name || 'AI PM'} · {fmtDate(created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Alert ────────────────────────────────────────────────────────────────────
  if (isAlert) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>⚠️</div>
        <div style={{
          maxWidth:     '82%',
          padding:      '10px 14px',
          borderRadius: '4px 14px 14px 14px',
          background:   T.redSoft,
          border:       `1px solid ${T.redBorder}`,
          fontFamily:   "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.red, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Alert
          </div>
          <p style={{ fontSize: 12, color: T.text, lineHeight: 1.5, margin: 0 }}>
            {content}
          </p>
          <div style={{ fontSize: 9, color: T.textSoft, marginTop: 6 }}>
            {from_name || 'AI PM'} · {fmtDate(created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Natural / prose from AIPM ─────────────────────────────────────────────
  if (isNatural || (isAipm && !isBriefing && !isAlert)) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>🤖</div>
        <div style={{
          maxWidth:     '80%',
          padding:      '9px 13px',
          borderRadius: '4px 14px 14px 14px',
          background:   T.accentSoft,
          border:       `1px solid ${T.accentBorder}`,
          fontFamily:   "'DM Sans', sans-serif",
        }}>
          <p style={{ fontSize: 12, color: T.text, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>
            {content}
          </p>
          <div style={{ fontSize: 9, color: T.textSoft, marginTop: 5 }}>
            {from_name || 'AI PM'} · {fmtDate(created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Agent structured report card ─────────────────────────────────────────────
  const label        = metadata?.label || from_name || 'Agent Report'
  const fields       = metadata?.fields || []
  const delivFiles   = deliverables || []
  const agentEmoji   = metadata?.emoji || '🤖'

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{agentEmoji}</div>
      <div style={{
        maxWidth:     '85%',
        borderRadius: '4px 14px 14px 14px',
        border:       `1px solid ${T.border}`,
        background:   T.surface,
        overflow:     'hidden',
        fontFamily:   "'DM Sans', sans-serif",
        boxShadow:    '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* Card header */}
        <div style={{
          padding:    '8px 12px',
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          display:    'flex',
          alignItems: 'center',
          gap:        6,
        }}>
          <span style={{
            fontSize:   10,
            fontWeight: 700,
            color:      T.textMid,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {label}
          </span>
          <span style={{ fontSize: 9, color: T.textSoft, marginLeft: 'auto' }}>
            {fmtDate(created_at)}
          </span>
        </div>

        {/* Content / summary */}
        {content && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: T.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {content}
          </div>
        )}

        {/* Fields */}
        {fields.length > 0 && (
          <div style={{
            padding:     '0 12px 8px',
            display:     'flex',
            flexDirection: 'column',
            gap:         4,
          }}>
            {fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textSoft, minWidth: 80, paddingTop: 1 }}>
                  {f.label}:
                </span>
                <span style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Deliverables */}
        {delivFiles.length > 0 && (
          <div style={{
            padding:    '8px 12px',
            borderTop:  `1px solid ${T.borderLight}`,
            background: T.greenSoft,
            display:    'flex',
            flexDirection: 'column',
            gap:        5,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Deliverables
            </div>
            {delivFiles.map((f, i) => (
              <FilePill key={f.id || i} file={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CommsPanel ───────────────────────────────────────────────────────────────
export default function CommsPanel({ project, threadMessages = [], onSendMessage, sending }) {
  const [input, setInput] = useState('')
  const scrollRef         = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [threadMessages, sending])

  function handleSend() {
    const msg = input.trim()
    if (!msg || sending) return
    onSendMessage(msg)
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      fontFamily:    "'DM Sans', sans-serif",
    }}>
      {/* ── Message list ────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex:      1,
          overflowY: 'auto',
          padding:   '16px',
        }}
      >
        {/* Empty state */}
        {threadMessages.length === 0 && !sending && (
          <div style={{
            textAlign:  'center',
            padding:    '48px 0',
            color:      T.textSoft,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textMid }}>Team thread</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Messages from AI PM, agents, and you will appear here.
            </div>
          </div>
        )}

        {/* Messages */}
        {threadMessages.map((msg, i) => (
          <MessageBubble key={msg.id || i} msg={msg} />
        ))}

        {/* Thinking animation while sending */}
        {sending && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>🤖</div>
            <div style={{
              padding:      '9px 13px',
              borderRadius: '4px 14px 14px 14px',
              background:   T.accentSoft,
              border:       `1px solid ${T.accentBorder}`,
            }}>
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <div style={{
        padding:      '10px 14px',
        borderTop:    `1px solid ${T.border}`,
        display:      'flex',
        gap:          8,
        background:   T.surface,
        flexShrink:   0,
        alignItems:   'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the team…"
          rows={1}
          disabled={sending}
          style={{
            flex:       1,
            padding:    '8px 12px',
            borderRadius: 10,
            border:     `1.5px solid ${T.border}`,
            background: T.bg,
            fontSize:   12,
            resize:     'none',
            lineHeight: 1.5,
            maxHeight:  80,
            overflowY:  'auto',
            color:      T.text,
            fontFamily: "'DM Sans', sans-serif",
            opacity:    sending ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            width:          36,
            height:         36,
            borderRadius:   10,
            border:         'none',
            background:     (sending || !input.trim()) ? T.accentBorder : T.accent,
            color:          '#fff',
            cursor:         (sending || !input.trim()) ? 'not-allowed' : 'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       15,
            flexShrink:     0,
            transition:     'background 0.15s',
          }}
        >
          {sending ? (
            <span style={{
              width:        14,
              height:       14,
              border:       '2px solid rgba(255,255,255,0.4)',
              borderTop:    '2px solid #fff',
              borderRadius: '50%',
              display:      'block',
              animation:    'spin 0.7s linear infinite',
            }} />
          ) : '↑'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
