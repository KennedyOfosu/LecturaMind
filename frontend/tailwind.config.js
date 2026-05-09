/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#152744',
          light: '#1e3a5f',
          dark: '#0d1c2e',
        },
        teal: {
          DEFAULT: '#0D9488',
          light: '#14b8a6',
          dark: '#0f766e',
        },
        background: '#F0F4F8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
