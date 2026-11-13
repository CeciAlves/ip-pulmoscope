/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-green': '#183D09',
        'olive-green': '#738839',
        'cream': '#EFE7D4',
        'teal-dark': '#497372',
        'soft-blue': '#7BB3C4',
        'bg-base': '#090a0b',
        'bg-panel': '#121316',
        'bg-card': '#1a1b20',
        'border-custom': '#272930',
        'text-muted': '#9a9ea8',
      }
    },
  },
  plugins: [],
}