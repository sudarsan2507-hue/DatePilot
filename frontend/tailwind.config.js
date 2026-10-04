/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#a65d45',
          600: '#8f4935',
          700: '#763c2d',
          800: '#9f1239',
          900: '#881337',
        },
        warm: {
          50: '#faf9f6',
          100: '#f5f3ef',
          200: '#ece8e1',
          300: '#ded7cc',
          400: '#84746a',
          500: '#746358',
          800: '#3a342c',
          900: '#231f1a',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
