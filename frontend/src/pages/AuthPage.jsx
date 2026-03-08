// ═══════════════════════════════════════════════════════════════════════════
// AuthPage — Login + Signup with Supabase auth
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { T } from '../utils/constants'

export default function AuthPage() {
  const navigate = useNavigate()

  const [tab,         setTab]         = useState('signin')  // 'signin' | 'signup'
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // ─── Handle form submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (tab === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        navigate('/')
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] }
          }
        })
        if (err) throw err
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setTab('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Input style helper ───────────────────────────────────────────────────
  const inputStyle = {
    width:        '100%',
    padding:      '10px 14px',
    border:       `1.5px solid ${T.border}`,
    borderRadius: 10,
    fontSize:     14,
    fontFamily:   "'DM Sans', sans-serif",
    background:   T.surface,
    color:        T.text,
    transition:   'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     T.bg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        24,
      fontFamily:     "'DM Sans', sans-serif",
    }}>
      {/* ── Auth Card ─────────────────────────────────────────────────── */}
      <div style={{
        width:        '100%',
        maxWidth:     420,
        background:   T.surface,
        borderRadius: 20,
        border:       `1px solid ${T.border}`,
        boxShadow:    '0 4px 32px rgba(0,0,0,0.06)',
        overflow:     'hidden',
        animation:    'fadeIn 0.25s ease both',
      }}>
        {/* ── Header / Logo ─────────────────────────────────────────── */}
        <div style={{
          padding:    '36px 36px 28px',
          borderBottom: `1px solid ${T.borderLight}`,
          textAlign:  'center',
        }}>
          {/* Logo icon */}
          <div style={{
            width:        56,
            height:       56,
            borderRadius: 16,
            background:   T.accent,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            margin:       '0 auto 16px',
            fontSize:     26,
          }}>
            🤖
          </div>

          {/* Heading — Fraunces serif */}
          <h1 style={{
            fontFamily:  "'Fraunces', Georgia, serif",
            fontSize:    28,
            fontWeight:  900,
            color:       T.text,
            lineHeight:  1.1,
            marginBottom: 6,
          }}>
            AI PM
          </h1>
          <p style={{ color: T.textSoft, fontSize: 13 }}>
            Smart project manager
          </p>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div style={{
          display:    'flex',
          padding:    '16px 36px 0',
          gap:        4,
        }}>
          {[
            { key: 'signin', label: 'Sign in' },
            { key: 'signup', label: 'Create account' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); setSuccess('') }}
              style={{
                flex:         1,
                padding:      '8px 0',
                border:       'none',
                background:   tab === t.key ? T.accent : 'transparent',
                color:        tab === t.key ? '#fff' : T.textMid,
                borderRadius: 8,
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'background 0.15s, color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 36px 36px' }}>
          {/* Error banner */}
          {error && (
            <div style={{
              padding:      '10px 14px',
              background:   T.redSoft,
              border:       `1px solid ${T.redBorder}`,
              borderRadius: 10,
              color:        T.red,
              fontSize:     13,
              marginBottom: 16,
              animation:    'fadeIn 0.15s ease both',
            }}>
              {error}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div style={{
              padding:      '10px 14px',
              background:   T.greenSoft,
              border:       `1px solid ${T.greenBorder}`,
              borderRadius: 10,
              color:        T.green,
              fontSize:     13,
              marginBottom: 16,
              animation:    'fadeIn 0.15s ease both',
            }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Display name — signup only */}
            {tab === 'signup' && (
              <div style={{ animation: 'expandDown 0.18s ease both' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMid, marginBottom: 6 }}>
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMid, marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMid, marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? 'At least 8 characters' : 'Your password'}
                required
                minLength={tab === 'signup' ? 8 : undefined}
                style={inputStyle}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width:        '100%',
                padding:      '12px 0',
                background:   loading ? T.accentBorder : T.accent,
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                fontSize:     14,
                fontWeight:   700,
                cursor:       loading ? 'wait' : 'pointer',
                marginTop:    6,
                transition:   'background 0.15s, transform 0.1s',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          8,
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display:      'inline-block',
                    width:        16,
                    height:       16,
                    border:       '2px solid rgba(255,255,255,0.4)',
                    borderTop:    '2px solid #fff',
                    borderRadius: '50%',
                    animation:    'spin 0.7s linear infinite',
                  }} />
                  {tab === 'signin' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                tab === 'signin' ? 'Sign in' : 'Create account'
              )}
            </button>
          </div>

          {/* Footer note */}
          <p style={{
            textAlign:  'center',
            marginTop:  20,
            fontSize:   12,
            color:      T.textSoft,
          }}>
            {tab === 'signin'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError('') }}
              style={{
                background: 'none',
                border:     'none',
                color:      T.accent,
                cursor:     'pointer',
                fontSize:   12,
                fontWeight: 600,
                padding:    0,
              }}
            >
              {tab === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
