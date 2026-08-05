import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Algorithm dark palette
        "deep-navy": "#05070b",
        "navy": "#0f1520",
        "slate": "#172032",
        "slate-light": "#1e293b",
        "slate-hover": "#263348",
        // Text
        "text-primary": "#f0f2f7",
        "text-sub": "#b8c0d4",
        "text-muted": "#8a94b0",
        // Accents
        "accent": "#4f8cff",
        "accent-2": "#00e0a0",
        "accent-purple": "#8a5cff",
        "accent-orange": "#ff8c32",
        "accent-cyan": "#00a9d9",
        // Priority
        "priority-high": "#c1272d",
        "priority-medium": "#b8860b",
        "priority-low": "#8a94b0",
      },
      boxShadow: {
        "glow-blue": "0 8px 30px rgba(79, 140, 255, 0.12)",
        "glow-blue-lg": "0 16px 50px rgba(79, 140, 255, 0.25)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f8cff 0%, #00e0a0 100%)",
      },
      borderRadius: {
        "pill": "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
