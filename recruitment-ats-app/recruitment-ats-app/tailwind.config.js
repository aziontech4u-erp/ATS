/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#eff3ff',
          100: '#e0e9ff',
          500: '#2756e8',
          600: '#1d4ed8',
          700: '#1e40af'
        }
      }
    }
  },
  plugins: []
};
