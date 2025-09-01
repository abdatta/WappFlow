/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        "wa-bg": "#111b21",
        "wa-panel": "#1f2c34",
        "wa-hover": "#2a3942",
        "wa-green": "#00a884",
      },
    },
  },
  plugins: [],
};
