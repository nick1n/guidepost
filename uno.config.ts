import { defineConfig, presetIcons } from "unocss";

export default defineConfig({
  presets: [presetIcons()],
  theme: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      "muted-foreground": "var(--muted-foreground)",
      accent: "var(--accent)",
      "accent-foreground": "var(--accent-foreground)",
      "accent-blue": "var(--accent-blue)",
      "accent-green": "var(--accent-green)",
      "accent-red": "var(--accent-red)",
      "accent-purple": "var(--accent-purple)",
      destructive: "var(--destructive)",
      secondary: "var(--secondary)",
      border: "var(--border)",
      panel: "var(--panel)",
      beta: "var(--beta)",
    },
    font: {
      display: "'Barlow Condensed', 'Inter', sans-serif",
    },
  },
});
