// ═══════════════════════════════════════════════════════════════════════════
// AIPMChatBar — collapsible AI PM chat bar (always visible toggle strip)
// Props: projectId (optional — null = global chat)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import { T } from '../../utils/constants'
import { chat } from '../../services/api'

export default function AIPMChatBar({ projectId }) {
  const [chatOpen,   setChatOpen]   = useState(false)
  const [chatInput,  setChatInput]  = useState('')
  const [thinking,   setThinking]   = useState(false)
  const [history,    setHistory]    = useState([])    // [{ role, content }]
  const [pendingReply, setPendingReply] = useState(false)

  const scrollRef  = useRef(null)
  const inputRef   = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, chatOpen])

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chatOpen])

  // ─── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const msg = chatInput.trim()
    if (!msg || thinking) return

    const userMsg = { role: 'user', content: msg }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setChatInput('')
    setThinking(true)
    setPendingReply(false)

    try {
      let res
      if (projectId) {
        res = await chat.sendToProject(projectId, msg, newHistory)
      } else {
        res = await chat.send(newHistory)
      }

      const aiContent = res.reply || res.content || res.message || 'Done.'
      setHistory(prev => [...prev, { role: 'assistant', content: aiContent }])

      // If chat is closed and we got a reply, show pending indicator
      if (!chatOpen) setPendingReply(true)

    } catch (err) {
      const errMsg = err.response?.data?.message || 'Something went wrong. Please try again.'
      setHistory(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setThinking(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Thinking dots animation ───────────────────────────────────────────────
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

  const chatHeight = chatOpen ? 320 : 0

  return (
    <div style={{
      position:     'relative',
      flexShrink:   0,
      background:   T.surface,
      borderTop:    `1px solid ${T.border}`,
      fontFamily:   "'DM Sans', sans-serif",
      zIndex:       30,
    }}>
      {/* ── Toggle strip — always visible ───────────────────────────── */}
      <div
        onClick={() => { setChatOpen(o => !o); setPendingReply(false) }}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 16px',
          cursor:         'pointer',
          background:     chatOpen ? T.accentSoft : T.surface,
          transition:     'background 0.15s',
          userSelect:     'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{
            fontSize:   12,
            fontWeight: 600,
            color:      T.accent,
            fontFamily: "'Fraunces', Georgia, serif",
          }}>
            AI PM
          </span>
          <span style={{ fontSize: 11, color: T.textSoft }}>
            {projectId ? 'Project assistant' : 'Global assistant'}
          </span>

          {/* Pending reply indicator */}
          {pendingReply && !chatOpen && (
            <span style={{
              padding:      '2px 8px',
              borderRadius: 999,
              background:   T.accentSoft,
              border:       `1px solid ${T.accentBorder}`,
              color:        T.accent,
              fontSize:     10,
              fontWeight:   600,
              animation:    'pulse 2s ease infinite',
            }}>
              Reply waiting ●
            </span>
          )}

          {/* Thinking indicator when collapsed */}
          {thinking && !chatOpen && (
            <span style={{ fontSize: 10, color: T.textSoft, animation: 'pulse 1.5s ease infinite' }}>
              Thinking…
            </span>
          )}
        </div>

        {/* Chevron */}
        <span style={{
          fontSize:   13,
          color:      T.textMid,
          transform:  chatOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
        }}>
          ▲
        </span>
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      <div style={{
        height:     chatHeight,
        overflow:   'hidden',
        transition: 'height 0.22s ease',
        display:    'flex',
        flexDirection: 'column',
      }}>
        {/* Messages scroll area */}
        <div
          ref={scrollRef}
          style={{
            flex:       1,
            overflowY:  'auto',
            padding:    '12px 16px',
            display:    'flex',
            flexDirection: 'column',
            gap:        8,
          }}
        >
          {/* Empty state */}
          {history.length === 0 && (
            <div style={{
              textAlign:  'center',
              color:      T.textSoft,
              fontSize:   12,
              marginTop:  24,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
              <div style={{ fontWeight: 600, color: T.textMid }}>Ask AI PM anything</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                {projectId
                  ? 'I know everything about this project.'
                  : 'Tell me what you want to get done.'}
              </div>
            </div>
          )}

          {/* Message history */}
          {history.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={i}
                className="animate-fade-in"
                style={{
                  display:   'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                {!isUser && (
                  <span style={{
                    fontSize:   15,
                    marginRight: 6,
                    marginTop:  2,
                    flexShrink: 0,
                  }}>
                    🤖
                  </span>
                )}
                <div style={{
                  maxWidth:     '75%',
                  padding:      '8px 12px',
                  borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background:   isUser ? T.accent : T.accentSoft,
                  color:        isUser ? '#fff' : T.text,
                  fontSize:     12,
                  lineHeight:   1.5,
                  border:       isUser ? 'none' : `1px solid ${T.accentBorder}`,
                  whiteSpace:   'pre-wrap',
                  wordBreak:    'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            )
          })}

          {/* Thinking dots */}
          {thinking && (
            <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>🤖</span>
              <div style={{
                padding:      '8px 12px',
                borderRadius: '12px 12px 12px 4px',
                background:   T.accentSoft,
                border:       `1px solid ${T.accentBorder}`,
              }}>
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>

        {/* ── Input row ───────────────────────────────────────────────── */}
        <div style={{
          padding:      '8px 12px',
          borderTop:    `1px solid ${T.borderLight}`,
          display:      'flex',
          alignItems:   'flex-end',
          gap:          8,
          background:   T.surface,
        }}>
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell AI PM what you want to get done…"
            disabled={thinking}
            rows={1}
            style={{
              flex:         1,
              padding:      '8px 12px',
              borderRadius: 10,
              border:       `1.5px solid ${T.border}`,
              background:   T.bg,
              fontSize:     12,
              resize:       'none',
              lineHeight:   1.5,
              maxHeight:    80,
              overflowY:    'auto',
              color:        T.text,
              fontFamily:   "'DM Sans', sans-serif",
              opacity:      thinking ? 0.6 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={thinking || !chatInput.trim()}
            style={{
              width:          36,
              height:         36,
              borderRadius:   10,
              border:         'none',
              background:     (thinking || !chatInput.trim()) ? T.accentBorder : T.accent,
              color:          '#fff',
              cursor:         (thinking || !chatInput.trim()) ? 'not-allowed' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       15,
              flexShrink:     0,
              transition:     'background 0.15s',
            }}
          >
            {thinking ? (
              <span style={{
                width:      14,
                height:     14,
                border:     '2px solid rgba(255,255,255,0.4)',
                borderTop:  '2px solid #fff',
                borderRadius: '50%',
                display:    'block',
                animation:  'spin 0.7s linear infinite',
              }} />
            ) : '↑'}
          </button>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
