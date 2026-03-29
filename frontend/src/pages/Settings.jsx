// ═══════════════════════════════════════════════════════════════════════════
// Settings — user profile + persistent API key management
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { T } from '../utils/constants'
import * as api from '../services/api'

export default function Settings({ onClose }) {
  const { user, logout } = useApp()

  const [keys,        setKeys]        = useState([])
  const [newKeyName,  setNewKeyName]  = useState('')
  const [newKeyValue, setNewKeyValue] = useState(null)  // shown ONCE after creation
  const [copied,      setCopied]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => { loadKeys() }, [])

  async function loadKeys() {
    try {
      const data = await api.apiKeys.list()
      setKeys(data)
    } catch (_) {}
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const created = await api.apiKeys.create(newKeyName.trim())
      setNewKeyValue(created.key)   // raw key — only shown once
      setNewKeyName('')
      setCopied(false)
      await loadKeys()
    } catch (err) {
      setError('Failed to create key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(id, name) {
    if (!window.confirm(`Revoke key "${name}"? This cannot be undone.`)) return
    try {
      await api.apiKeys.revoke(id)
      if (newKeyValue) setNewKeyValue(null)
      await loadKeys()
    } catch (_) {}
  }

  function handleCopy(value) {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function fmtDate(d) {
    if (!d) return 'Never'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: T.surface, borderRadius: 16,
        border: `1px solid ${T.border}`,
        width: '100%', maxWidth: 560,
        padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: T.text, margin: 0 }}>
            Settings
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: T.textSoft }}>×</button>
        </div>

        {/* Profile */}
        <section style={{ marginBottom: 24 }}>
          <SectionLabel>Profile</SectionLabel>
          <div style={{
            background: T.bg, borderRadius: 10, border: `1px solid ${T.border}`,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: T.accentSoft, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18, fontWeight: 700, color: T.accent, flexShrink: 0,
            }}>
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{user?.name || '—'}</div>
              <div style={{ fontSize: 11, color: T.textSoft }}>{user?.email}</div>
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section style={{ marginBottom: 24 }}>
          <SectionLabel>API Keys</SectionLabel>
          <p style={{ fontSize: 12, color: T.textSoft, margin: '0 0 12px' }}>
            Persistent keys for Maximus/OpenClaw integration. Use header <code style={{ background: T.bg, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>X-API-Key: aipm_…</code>.
            Keys never expire — revoke if compromised.
          </p>

          {/* New key revealed after creation */}
          {newKeyValue && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
                ✓ Key created — copy it now. It will never be shown again.
              </div>
              <div style={{
                background: '#fff', border: '1px solid #bbf7d0',
                borderRadius: 6, padding: '8px 10px',
                fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all',
                color: '#166534', marginBottom: 8,
              }}>
                {newKeyValue}
              </div>
              <button
                onClick={() => handleCopy(newKeyValue)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: copied ? '#16a34a' : '#22c55e',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy Key'}
              </button>
            </div>
          )}

          {/* Create new key */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder='Key name, e.g. "Maximus Integration"'
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.bg,
                fontSize: 12, color: T.text, outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button
              onClick={handleCreate}
              disabled={loading || !newKeyName.trim()}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: T.accent, color: '#fff',
                fontSize: 12, fontWeight: 700,
                cursor: loading || !newKeyName.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !newKeyName.trim() ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Creating…' : '+ Create Key'}
            </button>
          </div>

          {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}

          {/* Keys list */}
          {keys.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px 0',
              fontSize: 12, color: T.textSoft,
              border: `1px dashed ${T.border}`, borderRadius: 10,
            }}>
              No API keys yet. Create one above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {keys.map(k => (
                <div key={k.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{k.name}</div>
                    <div style={{ fontSize: 10, color: T.textSoft, fontFamily: 'monospace', marginTop: 2 }}>
                      {k.key_prefix}••••••••••••••••••••
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSoft, textAlign: 'right', flexShrink: 0 }}>
                    <div>Created {fmtDate(k.created_at)}</div>
                    <div>Last used {fmtDate(k.last_used)}</div>
                  </div>
                  <button
                    onClick={() => handleRevoke(k.id, k.name)}
                    style={{
                      padding: '4px 10px', borderRadius: 6,
                      border: '1px solid #fca5a5', background: 'transparent',
                      color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Usage for Maximus */}
          {keys.length > 0 && (
            <div style={{
              marginTop: 12, background: '#1e1e1e', borderRadius: 8,
              padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#d4d4d4',
            }}>
              <span style={{ color: '#569cd6' }}>curl</span>
              {' -H "X-API-Key: aipm_…" \\\n  https://aipm.waresmith.tech/api/projects'}
            </div>
          )}
        </section>

        {/* Sign out */}
        <section style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid #fca5a5', background: 'transparent',
              color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.textSoft,
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}
