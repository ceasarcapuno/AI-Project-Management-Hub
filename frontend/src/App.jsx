// ═══════════════════════════════════════════════════════════════════════════
// App.jsx — Root component with routing and auth guard
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { T } from './utils/constants'
import Dashboard from './pages/Dashboard'
import AuthPage from './pages/AuthPage'

// ─── Auth-guarded inner shell ─────────────────────────────────────────────────
function AppShell() {
  const { user, authLoading } = useApp()

  // Full-screen loading spinner while Supabase resolves session
  if (authLoading) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100vh',
        background:     T.bg,
        flexDirection:  'column',
        gap:            16,
      }}>
        {/* Spinner */}
        <div style={{
          width:        40,
          height:       40,
          border:       `3px solid ${T.border}`,
          borderTop:    `3px solid ${T.accent}`,
          borderRadius: '50%',
          animation:    'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          color:      T.textSoft,
          fontSize:   14,
        }}>
          Loading…
        </span>
      </div>
    )
  }

  return (
    <Routes>
      {/* Auth page */}
      <Route path="/auth" element={
        user ? <Navigate to="/" replace /> : <AuthPage />
      } />

      {/* Main app — require auth */}
      <Route path="/*" element={
        user ? <Dashboard /> : <Navigate to="/auth" replace />
      } />
    </Routes>
  )
}

// ─── Root App wrapped in AppProvider ─────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
