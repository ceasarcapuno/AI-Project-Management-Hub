// ═══════════════════════════════════════════════════════════════════════════
// Settings — user profile + API token management
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { T } from '../utils/constants'
import * as api from '../services/api'

export default function Settings({ onClose }) {
  const { user, logout } = useApp()

  const [token,   setToken]   = useState(null)
  const [copied,  setCopied]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleGenerateToken() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.auth.generateToken()
      setToken(res.token)
      setCopied(false)
    } catch (err) {
      setError('Failed to generate token. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(0,0,0,0.35)',
      zIndex:     100,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:   T.surface,
        borderRadius: 16,
        border:       `1px solid ${T.border}`,
        width:        '100%',
        maxWidth:     520,
        padding:      28,
        boxShadow:    '0 8px 32px rgba(0,0,0,0.12)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize:   20,
            fontWeight: 800,
            color:      T.text,
            margin:     0,
          }}>
            Settings
          </h2>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 20, color: T.textSoft, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Profile section */}
        <section style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textSoft,
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
          }}>
            Profile
          </div>
          <div style={{
            background:   T.bg,
            borderRadius: 10,
            border:       `1px solid ${T.border}`,
            padding:      '12px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <div style={{
              width:          40,
              height:         40,
              borderRadius:   '50%',
              background:     T.accentSoft,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       18,
              fontWeight:     700,
              color:          T.accent,
              flexShrink:     0,
            }}>
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {user?.name || '—'}
              </div>
              <div style={{ fontSize: 11, color: T.textSoft }}>
                {user?.email}
              </div>
            </div>
          </div>
        </section>

        {/* API Token section */}
        <section style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textSoft,
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
          }}>
            API Token
          </div>
          <p style={{ fontSize: 12, color: T.textSoft, margin: '0 0 12px' }}>
            Use this token to authenticate API requests (e.g. for Maximus/OpenClaw integration).
            Valid for 7 days. Keep it secret.
          </p>

          {token ? (
            <div>
              <div style={{
                background:   T.bg,
                border:       `1px solid ${T.border}`,
                borderRadius: 8,
                padding:      '10px 12px',
                fontFamily:   'monospace',
                fontSize:     11,
                color:        T.text,
                wordBreak:    'break-all',
                marginBottom: 8,
                maxHeight:    80,
                overflowY:    'auto',
              }}>
                {token}
              </div>
              <button
                onClick={handleCopy}
                style={{
                  padding:      '8px 16px',
                  borderRadius: 8,
                  border:       'none',
                  background:   copied ? T.green : T.accent,
                  color:        '#fff',
                  fontSize:     12,
                  fontWeight:   700,
                  cursor:       'pointer',
                  transition:   'background 0.15s',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy Token'}
              </button>
              <div style={{ fontSize: 10, color: T.textSoft, marginTop: 6 }}>
                Share this with Maximus via secure channel. Expires in 7 days.
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateToken}
              disabled={loading}
              style={{
                padding:      '9px 18px',
                borderRadius: 8,
                border:       'none',
                background:   T.accent,
                color:        '#fff',
                fontSize:     13,
                fontWeight:   700,
                cursor:       loading ? 'not-allowed' : 'pointer',
                opacity:      loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Generating…' : 'Generate API Token'}
            </button>
          )}

          {error && (
            <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>{error}</div>
          )}
        </section>

        {/* Usage example */}
        {token && (
          <section style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.textSoft,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
            }}>
              Usage Example
            </div>
            <div style={{
              background:   '#1e1e1e',
              borderRadius: 8,
              padding:      '10px 14px',
              fontFamily:   'monospace',
              fontSize:     11,
              color:        '#d4d4d4',
              overflowX:    'auto',
            }}>
              <span style={{ color: '#569cd6' }}>curl</span>
              {' -H "Authorization: Bearer '}
              <span style={{ color: '#ce9178' }}>{token.slice(0, 20)}…</span>
              {'" \\\n  https://aipm.waresmith.tech/api/projects'}
            </div>
          </section>
        )}

        {/* Danger zone */}
        <section style={{
          borderTop:  `1px solid ${T.border}`,
          paddingTop: 16,
          display:    'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={logout}
            style={{
              padding:      '8px 16px',
              borderRadius: 8,
              border:       `1px solid ${T.redBorder || '#fca5a5'}`,
              background:   'transparent',
              color:        T.red || '#ef4444',
              fontSize:     12,
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}
