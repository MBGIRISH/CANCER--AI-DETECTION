/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        charcoal: {
          900: '#0a0a0c',
          800: '#121214',
          700: '#1c1c1e',
          600: '#2c2c2e',
        },
        clinicalCyan: '#00b4d8',
        clinicalBlue: '#0077b6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.85' },
        },
      }
    },
  },
  plugins: [],
}

