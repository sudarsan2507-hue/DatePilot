/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DatePilot palette (see .claude/skills/datepilot-ui)
        cream: '#f4f0e8',
        paper: '#fffdf9',
        line: '#ded5c8',
        well: '#f9f6f0',
        ink: { DEFAULT: '#382a22', 2: '#59473b', 3: '#746358' },
        accent: { DEFAULT: '#8f4935', deep: '#763c2d', soft: '#a65d45' },
        sage: '#7f8a70',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['"Avenir Next"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(56 42 34 / 0.04), 0 8px 24px rgb(56 42 34 / 0.05)',
      },
      keyframes: {
        enter: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        enter: 'enter 200ms ease-out both',
      },
    },
  },
  plugins: [],
}
