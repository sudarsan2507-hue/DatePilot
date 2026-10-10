/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DatePilot palette (see .claude/skills/datepilot-ui). Direction borrowed from design-led
        // dating apps (Hinge): warm off-white, near-black ink, colour saved for photos and accents.
        cream: '#f4f0e8',
        paper: '#fffdf9',
        line: '#ded5c8',
        well: '#f9f6f0',
        ink: { DEFAULT: '#2b211c', deep: '#1c1512', 2: '#4f4038', 3: '#6f5f54' },
        accent: { DEFAULT: '#8f4935', deep: '#763c2d', soft: '#a65d45' },
        sage: '#7f8a70',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['"Avenir Next"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(43 33 28 / 0.04), 0 12px 32px -8px rgb(43 33 28 / 0.10)',
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
