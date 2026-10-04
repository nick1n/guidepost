import {
  statuses,
  statusIcons,
  type SurvivorStatusIcons,
  type StatusInfo,
  type IconContext,
  type Icon,
  type StatusIcons,
} from "#lib/constants.ts";

export function statusSummary(status: SurvivorStatusIcons) {
  const info = statuses[status];
  return info.summary ?? info.label;
}

export function iconView(icon: Icon, { active = false, context = "control" }: { active?: boolean; context?: IconContext } = {}) {
  const info: Omit<StatusInfo, "label"> = statuses[icon] ?? {
    icon: statusIcons[icon as StatusIcons],
    iconClass: `${icon}-icon`,
  };
  const symbol = active ? (info.activeIcon ?? info.icon) : info.icon;
  const role = info.iconClass ?? "status-icon";
  if (context === "quick" || context === "legend") {
    return [info.flagClass ?? role, info.flagIcon ?? symbol] as const;
  }
  return [role, symbol] as const;
}
