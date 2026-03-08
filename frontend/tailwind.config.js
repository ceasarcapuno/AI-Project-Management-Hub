/** @type {import('tailwindcss').Config} */
export default {
  // ─── Content Paths ────────────────────────────────────────────────────────
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ─── Custom Color Palette (AIPM Design System) ─────────────────────
      colors: {
        // Base dark surfaces
        'surface-0': '#0a0a0f',   // Deepest background
        'surface-1': '#111118',   // Primary background
        'surface-2': '#1a1a24',   // Card / panel background
        'surface-3': '#22222f',   // Elevated surface
        'surface-4': '#2a2a3a',   // Border-level surface

        // Accent colors
        'accent-blue':    '#3b82f6',
        'accent-purple':  '#8b5cf6',
        'accent-cyan':    '#06b6d4',
        'accent-green':   '#10b981',
        'accent-yellow':  '#f59e0b',
        'accent-orange':  '#f97316',
        'accent-red':     '#ef4444',
        'accent-pink':    '#ec4899',

        // Workspace identity colors
        'workspace-private':  '#8b5cf6',  // Purple — Private workspace
        'workspace-business': '#3b82f6',  // Blue   — Business workspace
        'workspace-work':     '#10b981',  // Green  — Work workspace

        // Text hierarchy
        'text-primary':   '#f0f0f8',
        'text-secondary': '#a0a0b8',
        'text-muted':     '#606078',
        'text-disabled':  '#404055',
      },

      // ─── Custom Fonts ───────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ─── Custom Animations ──────────────────────────────────────────────
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':       'fadeIn 0.2s ease-in-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-up':   'slideInUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
      },

      // ─── Custom Border Radius ───────────────────────────────────────────
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },

      // ─── Custom Backdrop Blur ───────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
