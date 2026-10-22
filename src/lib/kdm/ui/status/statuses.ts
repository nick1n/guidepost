export const statusIcons = {
  turn: "i-material-symbols:refresh",
  ready: "i-material-symbols:play-circle",
  dodge: "i-material-symbols:sprint",
  priority: "i-material-symbols:target",
} as const;

type StatusIcons = keyof typeof statusIcons;

type StatusInfo = {
  label: string;
  summary?: string;
  icon: string;
  iconClass?: string;
  activeIcon?: string;
  flagIcon?: string;
  flagClass?: string;
};

const statusDefinitions = {
  "status:threat": { label: "Threat", icon: "i-material-symbols:location-searching", activeIcon: "i-material-symbols:my-location" },
  "status:act": { label: "Act", summary: "Acted", icon: "i-material-symbols:play-circle", activeIcon: "i-material-symbols:check" },
  "status:monster-controller": {
    label: "Mon Controller",
    summary: "Monster Controller",
    icon: "i-material-symbols:sports-esports",
    iconClass: "controller-icon",
  },
  "status:blind-spot": {
    label: "In Blind Spot",
    icon: "i-lucide:eye-dashed",
    activeIcon: "i-lucide:eye-closed",
    flagIcon: "i-lucide:eye-dashed",
    flagClass: "blind-icon",
  },
  "status:knocked-down": { label: "Knocked Down", icon: "i-material-symbols:download-2", flagClass: "knocked-icon" },
  "status:insane": { label: "Insane", icon: "i-lucide:brain", iconClass: "insane-icon" },
  "status:retire": {
    label: "Retire",
    summary: "Retired",
    icon: "i-material-symbols:sleep",
    iconClass: "retired-icon",
    flagClass: "retired-icon",
  },
  "status:deaf": { label: "Deaf", icon: "i-lucide:ear", activeIcon: "i-lucide:ear-off" },
  "status:blind": { label: "Blind", icon: "i-lucide:eye", activeIcon: "i-lucide:eye-off" },
  "status:dead": { label: "Dead", icon: "i-material-symbols:sentiment-very-dissatisfied", iconClass: "dead-icon" },
  "status:cease-to-exist": {
    label: "Cease to Exist",
    icon: "i-material-symbols:deblur",
    activeIcon: "i-material-symbols:blur-on",
    iconClass: "cease-icon",
  },
} as const;
export type SurvivorStatusIcons = keyof typeof statusDefinitions;
export const statuses: Record<SurvivorStatusIcons, StatusInfo> = statusDefinitions;
export const statusOrder = Object.keys(statuses) as SurvivorStatusIcons[];
export const statusFlags = [
  "status:threat",
  "status:act",
  "status:monster-controller",
  "status:blind-spot",
  "status:knocked-down",
  "status:insane",
  "status:retire",
  "status:deaf",
  "status:blind",
] as const satisfies readonly SurvivorStatusIcons[];

export type Icon = SurvivorStatusIcons | StatusIcons;
export type IconContext = "control" | "quick" | "life" | "legend";

function isSurvivorStatus(icon: Icon): icon is SurvivorStatusIcons {
  return Object.hasOwn(statuses, icon);
}

export function statusSummary(status: SurvivorStatusIcons) {
  const info = statuses[status];
  return info.summary ?? info.label;
}

export function iconView(icon: Icon, { active = false, context = "control" }: { active?: boolean; context?: IconContext } = {}) {
  const info: Omit<StatusInfo, "label"> = isSurvivorStatus(icon) ? statuses[icon] : { icon: statusIcons[icon], iconClass: `${icon}-icon` };
  const symbol = active ? (info.activeIcon ?? info.icon) : info.icon;
  const role = info.iconClass ?? "status-icon";
  if (context === "quick" || context === "legend") {
    return [info.flagClass ?? role, info.flagIcon ?? symbol] as const;
  }
  return [role, symbol] as const;
}
