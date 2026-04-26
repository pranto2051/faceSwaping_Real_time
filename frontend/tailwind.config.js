/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7F77DD',
          hover: '#534AB7',
        },
        success: '#1D9E75',
      },
    },
  },
  plugins: [],
}
