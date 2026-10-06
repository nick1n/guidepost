export function identity<T>(value: T): T {
  return value;
}

/** Keep in sync with the --duration-fast CSS custom property in src/app.css. */
export const DURATION_FAST = 180;

/** Hold threshold in milliseconds, also supplied to the hold ripple's CSS animation. */
export const DURATION_HOLD = 600;

export const KD_ICONS = {
  activation: "q",
  armor: "M",
  "armor-0": "*",
  "armor-1": "!",
  "armor-2": '"',
  "armor-3": "#",
  "armor-4": "$",
  "armor-5": "%",
  "armor-6": "&",
  "armor-7": "'",
  "armor-8": "(",
  "armor-9": ")",
  "armor-x": "d",
  "card-a": "h",
  "card-b": "i",
  "card-l": "k",
  "card-s": "j",
  "card-x": "g",
  craft: "o",
  "deck-ai": "O",
  "deck-d": "W",
  "deck-fa": "V",
  "deck-h": "X",
  "deck-hl": "N",
  "deck-i": "T",
  "deck-lantern": "c",
  "deck-o": "[",
  "deck-r": "U",
  "deck-se": "Y",
  "deck-sf": "S",
  "deck-sr": "R",
  "deck-t": "Q",
  "deck-v": "P",
  deck: "^",
  edit: "w",
  endeavor: "v",
  eye: "z",
  "flow-alert": "y",
  "flow-arrow": "x",
  "hit-arms": "{",
  "hit-body": "|",
  "hit-head": "\u00a1",
  "hit-legs": "}",
  "hit-waist": "~",
  hourglass: "\u00c4",
  "lantern-small": "f",
  lantern: "e",
  "location-arms": "-",
  "location-body": ",",
  "location-head": "+",
  "location-legs": "/",
  "location-waist": ".",
  "milestone-filled": "`",
  milestone: "]",
  "monster-butcher": "\u00a2",
  "monster-dragon-king": "\u00ab",
  "monster-dung-beetle-knight": "\u00ac",
  "monster-flower-knight": "\u00ba",
  "monster-gold-smoke-knight": "\u00a3",
  "monster-gorm": "\u00ae",
  "monster-kings-man": "\u00a5",
  "monster-lion-god": "\u00af",
  "monster-lion-knight": "\u00b1",
  "monster-lonely-tree": "\u00b2",
  "monster-manhunter": "\u00b3",
  "monster-phoenix": "\u00a6",
  "monster-screaming-antelope": "\u00a7",
  "monster-slenderman": "\u00b4",
  "monster-spidicules": "\u00b6",
  "monster-sunstalker-2": "\u2219",
  "monster-sunstalker": "\u00b7",
  "monster-the-hand": "\u00a4",
  "monster-tyrant": "\u00aa",
  "monster-watcher": "\u00a8",
  "monster-white-lion": "\u00a9",
  movement: "m",
  "persistent-injury": "p",
  puzzle: "Z",
  reflex: "r",
  require: "u",
  "roll-0": "0",
  "roll-1-plus": "B",
  "roll-1": "1",
  "roll-10-plus": "K",
  "roll-10": ":",
  "roll-11": ";",
  "roll-12": "<",
  "roll-13": "=",
  "roll-14": ">",
  "roll-15": "?",
  "roll-2-plus": "C",
  "roll-2": "2",
  "roll-3-plus": "D",
  "roll-3": "3",
  "roll-4-plus": "E",
  "roll-4": "4",
  "roll-5-plus": "F",
  "roll-5": "5",
  "roll-6-plus": "G",
  "roll-6": "6",
  "roll-7-plus": "H",
  "roll-7": "7",
  "roll-8-plus": "I",
  "roll-8": "8",
  "roll-9-plus": "J",
  "roll-9": "9",
  "roll-blank": "@",
  "roll-lantern": "L",
  "roll-black-1": "\u00e9",
  "roll-black-lantern": "\u00e3",
  "roll-plus": "A",
  "roll-x": "b",
  square: "_",
  star: "l",
  story: "s",
  swords: "n",
  trigger: "t",
} as const;

export type KdIconName = keyof typeof KD_ICONS;

export const statusIcons = {
  turn: "i-material-symbols:refresh",
  ready: "i-material-symbols:play-circle",
  dodge: "i-material-symbols:sprint",
  priority: "i-material-symbols:target",
} as const;

export type StatusIcons = keyof typeof statusIcons;

export type StatusInfo = {
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
export const statuses: Record<string, StatusInfo> = statusDefinitions;
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

export const sectionIcons: Record<string, string> = {
  "Survivor Attributes": "i-material-symbols:bar-chart",
  "Monster Attributes": "i-material-symbols:bar-chart",
  Actions: "i-material-symbols:swords",
  "Basic Action": "i-material-symbols:swords",
  "Common Actions": "i-material-symbols:menu-book",
  "Instinct: **Sniff**": "i-material-symbols:air",
  Status: "i-material-symbols:flag",
  "Gear Grid": "i-material-symbols:grid-view",
  Tokens: "i-material-symbols:token",
  "Attribute Tokens": "i-material-symbols:token",
  "Trinkets & Baubles": "i-material-symbols:diamond",
  "Fighting Arts": "i-material-symbols:sports-martial-arts",
  Disorders: "i-material-symbols:psychology",
  Abilities: "i-material-symbols:auto-awesome",
  "Impairments & Injuries": "i-material-symbols:healing",
  Resources: "i-material-symbols:inventory-2",
  "Resource Deck": "i-material-symbols:layers",
  "Per Lifetimes": "i-material-symbols:hourglass-top",
  "Cursed Gear": "i-material-symbols:skull",
  "Showdown History": "i-material-symbols:history",
  "Showdown Setup": "i-material-symbols:landscape",
  "Armor & Bonuses": "i-material-symbols:shield",
  Development: "i-material-symbols:trending-up",
  Notes: "i-material-symbols:edit-note",
  Miscellaneous: "i-material-symbols:person",
};
