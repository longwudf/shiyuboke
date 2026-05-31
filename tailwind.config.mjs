/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      colors: {
        ink: "#172033",
        paper: "#f7f8f3",
        accent: "#0f766e",
        coral: "#f9735b"
      },
      boxShadow: {
        soft: "0 18px 50px -28px rgb(15 23 42 / 0.45)"
      }
    }
  },
  plugins: []
};
