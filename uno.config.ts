import { defineConfig, presetIcons } from "unocss";
import { sectionIcons, statusIcons, statuses } from "#lib/constants.ts";

const statusIconSafelist = [
  ...new Set(
    Object.values(statuses)
      .flatMap((info) => [info.icon, info.activeIcon, info.flagIcon])
      .filter((icon) => icon !== undefined),
  ),
];

export default defineConfig({
  safelist: [
    ...Object.values(statusIcons),
    ...statusIconSafelist,
    ...Object.values(sectionIcons),
    "i-material-symbols:play-circle-outline",
    "i-material-symbols:inventory-2-outline-sharp",
    "i-material-symbols:route-outline-sharp",
    "i-material-symbols:cards-stack-outline-sharp",
    "i-material-symbols:sheets-outline",
    "i-material-symbols:3d-outline-sharp",
    "i-material-symbols:print-outline",
    "i-material-symbols:readiness-score-outline",
    "i-lucide:github",
    "i-material-symbols:favorite-outline",
    "i-material-symbols:warning-outline",
    "i-material-symbols:swap-horiz",
    "i-material-symbols:inventory-2-outline",
    "i-material-symbols:delete-outline",
    "i-material-symbols:fullscreen",
    "i-material-symbols:fullscreen-exit",
    "i-material-symbols:unfold-less-double",
    "i-material-symbols:unfold-more-double",
    "i-material-symbols:close",
  ],
  presets: [presetIcons()],
});
