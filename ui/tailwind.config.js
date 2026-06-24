/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          raised: "#161b27",
          border: "#1e2535",
          hover: "#1a2032",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          muted: "#312e81",
        },
        gold: {
          DEFAULT: "#f59e0b",
          muted: "#78350f",
          light: "#fcd34d",
        },
        status: {
          running: "#22c55e",
          stopped: "#64748b",
          failed: "#ef4444",
          starting: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
