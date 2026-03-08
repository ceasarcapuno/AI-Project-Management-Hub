/** @type {import('tailwindcss').Config} */
export default {
  // ─── Content Paths ──────────────────────────────────────────────────────
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ─── AIPM Warm Light Design System ──────────────────────────────────
      // These mirror the T object in src/utils/constants.js so you can
      // use Tailwind utilities alongside inline styles.
      colors: {
        // Base surfaces (warm off-white, not dark)
        'bg':           '#f9f8f6',
        'surface':      '#ffffff',
        'border':       '#e8e5e0',
        'border-light': '#f0ede8',

        // Text hierarchy
        'text-primary':   '#1a1915',
        'text-mid':       '#5c5753',
        'text-soft':      '#9a9590',

        // Accent — warm orange
        'accent':        '#d4692a',
        'accent-soft':   '#fdf3ec',
        'accent-border': '#f5c9a8',

        // Semantic colours
        'green':        '#2a7d4f',
        'green-soft':   '#edf7f1',
        'green-border': '#a8d9bc',
        'amber':        '#b45309',
        'amber-soft':   '#fffbeb',
        'amber-border': '#fcd34d',
        'red':          '#c0392b',
        'red-soft':     '#fff5f5',
        'red-border':   '#fca5a5',
        'blue':         '#2563eb',
        'blue-soft':    '#eff6ff',

        // Workspace identity
        'ws-private':  '#d97706',
        'ws-business': '#2563eb',
        'ws-work':     '#7c3aed',
      },

      // ─── Fonts ──────────────────────────────────────────────────────────
      fontFamily: {
        sans:    ["'DM Sans'", 'Segoe UI', 'system-ui', 'sans-serif'],
        serif:   ["'Fraunces'", 'Georgia', 'serif'],
        mono:    ["'JetBrains Mono'", 'Fira Code', 'monospace'],
      },

      // ─── Animations ─────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.2s ease both',
        'expand':     'expandDown 0.18s ease both',
        'slide-in':   'slideIn 0.22s ease both',
        'thinking':   'thinking 1.1s infinite',
        'pulse-dot':  'pulse 2s infinite',
      },
      keyframes: {
        fadeIn:      { from: { opacity: '0', transform: 'translateY(4px)' },  to: { opacity: '1', transform: 'none' } },
        expandDown:  { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        slideIn:     { from: { transform: 'translateX(-100%)' },              to: { transform: 'translateX(0)' } },
        thinking:    { '0%, 100%': { opacity: '0.25' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
