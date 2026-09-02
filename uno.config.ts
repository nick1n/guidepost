import { defineConfig, presetIcons } from "unocss";

export default defineConfig({
  safelist: [
    "i-material-symbols:play-circle-outline",
    "i-material-symbols:inventory-2-outline-sharp",
    "i-material-symbols:route-outline-sharp",
    "i-material-symbols:cards-stack-outline-sharp",
    "i-material-symbols:sheets-outline",
    "i-material-symbols:3d-outline-sharp",
    "i-material-symbols:print-outline",
    "i-material-symbols:readiness-score-outline",
    "i-mdi:github",
    "i-material-symbols:favorite-outline",
  ],
  presets: [presetIcons()],
});
