/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#070a12', 800: '#0b1020', 700: '#111834', 600: '#18203f' },
        line: '#1e2949',
        accent: { DEFAULT: '#6ea8ff', dim: '#3f6fd6' },
        pos: '#2fd4a7',
        neu: '#8b95b5',
        neg: '#ff5d73',
        warn: '#ffb02e',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(.8)', opacity: '.9' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateY(-6px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '0%,100%': { opacity: '.45' }, '50%': { opacity: '1' } },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        slideIn: 'slideIn .35s ease-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
