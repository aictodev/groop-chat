import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          surface: '#f0f2f5',
          'surface-alt': '#f7f8fa',
          panel: '#ffffff',
          'panel-muted': '#f5f6f6',
          border: '#d1d7db',
          divider: '#e9edef',
          accent: '#00a884',
          'accent-dark': '#008069',
          'accent-soft': '#d9fdd3',
          'accent-faded': '#edf8f5',
          ink: '#111b21',
          'ink-soft': '#667781',
          'ink-subtle': '#8696a0',
          'bubble-incoming': '#ffffff',
          'bubble-outgoing': '#d9fdd3',
          'bubble-system': '#e1f3ff',
          'bubble-meta': '#667781',
          'status-online': '#06d755',
          highlight: '#cff5eb',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        caption: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        bubble: '1.125rem',
        'bubble-lg': '1.5rem',
      },
      boxShadow: {
        bubble: '0 1px 1px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.08)',
        panel: '0 12px 24px rgba(17, 27, 33, 0.08)',
        landing: '0 8px 32px rgba(15, 23, 42, 0.25)',
      },
      spacing: {
        'sidebar-width': '360px',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        blink: 'blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
