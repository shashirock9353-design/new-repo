/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          500: '#4f9cff',
          600: '#2563eb',
        },
      },
      boxShadow: {
        glow: '0 0 30px rgba(79, 156, 255, 0.35)',
      },
    },
  },
  plugins: [],
}
