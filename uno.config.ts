import { defineConfig, presetIcons } from "unocss";
import { presetWind4 } from "@unocss/preset-wind4";

export default defineConfig({
  presets: [presetWind4(), presetIcons()],
  safelist: ["text-left", "text-center", "text-right", "select-none"],
  theme: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      "muted-foreground": "var(--muted-foreground)",
      accent: "var(--accent)",
      "accent-foreground": "var(--accent-foreground)",
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
