import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dae6ff",
          200: "#bcd2ff",
          300: "#8db3ff",
          400: "#5a8bff",
          500: "#3766ff",
          600: "#2147e8",
          700: "#1b37ba",
          800: "#1a3093",
          900: "#1b2d75",
          950: "#141d4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
