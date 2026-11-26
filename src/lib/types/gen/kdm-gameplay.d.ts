/* Generated from static/kdm/data/schema.json. Do not edit. Run pnpm generate:types to regenerate. */

export type Keyword =
  | "ability"
  | "accessory"
  | "ammonia-consequence"
  | "ammunition"
  | "armor"
  | "arrow"
  | "art"
  | "axe"
  | "badge"
  | "balm"
  | "bone"
  | "music"
  | "education"
  | "symposium-consequence"
  | "hovel-consequence"
  | "forbidden-dance-consequence"
  | "bow"
  | "cleaver"
  | "cloth"
  | "club"
  | "completed-set-bonus"
  | "consumable"
  | "conviction-principle"
  | "cooking-recipe"
  | "copper"
  | "crimson-crocodile"
  | "crude"
  | "cult"
  | "dagger"
  | "deathmetal"
  | "diamond"
  | "dragon-king"
  | "dung"
  | "emotion"
  | "faith"
  | "family-consequence"
  | "feather"
  | "fighting-art"
  | "finesse"
  | "fish"
  | "fist-tooth"
  | "flammable"
  | "flower-knight"
  | "flower"
  | "fragile"
  | "frogdog"
  | "fungus"
  | "fur"
  | "gce"
  | "gold"
  | "gorm"
  | "grand-weapon"
  | "gun"
  | "heavy"
  | "herb"
  | "hide"
  | "hollow"
  | "holy"
  | "home"
  | "impairment"
  | "indomitable"
  | "inner-lantern-consequence"
  | "innovation"
  | "instrument"
  | "iron"
  | "item"
  | "jewelry"
  | "katana"
  | "katar"
  | "knowledge"
  | "language-consequence"
  | "lantern-oven-consequence"
  | "lantern"
  | "leather"
  | "legendary-ability"
  | "mask"
  | "melee"
  | "messenger"
  | "metal"
  | "milestone"
  | "noisy"
  | "novel"
  | "order"
  | "organ"
  | "other"
  | "oven-consequence"
  | "perfect"
  | "permanent-injury"
  | "phoenix"
  | "pickaxe"
  | "ranged"
  | "rawhide"
  | "science"
  | "scimitar"
  | "scrap"
  | "screaming-antelope"
  | "screaming-god"
  | "sculpture-consequence"
  | "scythe"
  | "secret-fighting-art"
  | "seed"
  | "set"
  | "settlement-event"
  | "shield"
  | "sickle"
  | "silk"
  | "skull"
  | "society-principle"
  | "soluble"
  | "spear"
  | "spidicules"
  | "starting-innovation"
  | "starting"
  | "stinky"
  | "stone"
  | "strain"
  | "sunstalker"
  | "survivor-status"
  | "sword"
  | "thrown"
  | "tool"
  | "two-handed"
  | "vegetable"
  | "vermin"
  | "weapon-proficiency"
  | "weapon"
  | "whip"
  | "white-lion";
export type Keywords = Keyword[];
export type CanHook = ("activate" | "equip" | "depart" | "use-fighting-arts" | "use-abilities" | "glossary:ignore-hit") | SurvivalPrefixed;
export type SurvivalPrefixed =
  | "survival:dash"
  | "survival:distractedCat"
  | "survival:dodge"
  | "survival:embolden"
  | "survival:enchantedReflection"
  | "survival:encourage"
  | "survival:endure"
  | "survival:fistPump"
  | "survival:hatedOnes"
  | "survival:leapingLure"
  | "survival:oath"
  | "survival:overcharge"
  | "survival:silentRebellion"
  | "survival:surge"
  | "survival:unforeseenStrike";
export type OnHook =
  | "act"
  | "activate"
  | "affinity"
  | "aftermath:defeat"
  | "aftermath:victory"
  | "aftermath"
  | "archive"
  | "armor"
  | "arrival"
  | "attack"
  | "blind-spot"
  | "craft"
  | "critical"
  | "depart"
  | "disorder"
  | "equip"
  | "gain"
  | "gear-activated"
  | "heal"
  | "hunt"
  | "injury"
  | "newborn"
  | "perfect-hit"
  | "prompt"
  | "reaction"
  | "return"
  | "round-end"
  | "rounding"
  | "settlement-develop"
  | "settlement-end"
  | "settlement-start"
  | "severe"
  | "showdown-start"
  | "spend-survival"
  | "starting"
  | "status"
  | "suffer"
  | "survival"
  | "target"
  | "turn-end";
export type AttributePrefixed =
  | "attr:accuracy"
  | "attr:act-activate"
  | "attr:act-bone"
  | "attr:act-movement"
  | "attr:affinity-blue"
  | "attr:affinity-green"
  | "attr:affinity-red"
  | "attr:armor-all"
  | "attr:armor-any"
  | "attr:armor-arms"
  | "attr:armor-body"
  | "attr:armor-head"
  | "attr:armor-legs"
  | "attr:armor-waist"
  | "attr:born"
  | "attr:brain-damage"
  | "attr:children"
  | "attr:collective-cognition"
  | "attr:courage"
  | "attr:damage"
  | "attr:death-count"
  | "attr:disposition"
  | "attr:draw-fighting-arts"
  | "attr:draw-innovations"
  | "attr:evasion"
  | "attr:hunt-xp"
  | "attr:insanity"
  | "attr:life"
  | "attr:lost-settlements"
  | "attr:luck"
  | "attr:lumi"
  | "attr:max-disorders"
  | "attr:max-fighting-arts"
  | "attr:max-knowledges"
  | "attr:monster-level"
  | "attr:movement-extra"
  | "attr:movement"
  | "attr:perfect-hit-range"
  | "attr:population"
  | "attr:proficiency"
  | "attr:roll-any"
  | "attr:roll-hunt-event"
  | "attr:roll-intimacy"
  | "attr:roll-scavenge"
  | "attr:roll-severe"
  | "attr:roll-straggler"
  | "attr:roll-trauma"
  | "attr:roll"
  | "attr:speed"
  | "attr:star"
  | "attr:strength"
  | "attr:survival-limit"
  | "attr:survival"
  | "attr:systemic-pressure"
  | "attr:torment"
  | "attr:toughness"
  | "attr:understanding"
  | "attr:wounds";
export type StatusPrefixed =
  | "status:act"
  | "status:alive"
  | "status:blind-spot"
  | "status:blind"
  | "status:can-intimacy"
  | "status:can-partnership"
  | "status:catalyze"
  | "status:cease-to-exist"
  | "status:dead"
  | "status:deaf"
  | "status:death-count"
  | "status:departing"
  | "status:frenzied"
  | "status:insane"
  | "status:knocked-down"
  | "status:not-threat"
  | "status:removed"
  | "status:retire"
  | "status:returning"
  | "status:skip-next-hunt"
  | "status:standing"
  | "status:stinky"
  | "status:terrified";
export type TokenPrefixed =
  | "token:attribute-modifier"
  | "token:accuracy-negative"
  | "token:accuracy-positive"
  | "token:bleeding"
  | "token:charge"
  | "token:confidence"
  | "token:damage-negative"
  | "token:damage-positive"
  | "token:death"
  | "token:deflect"
  | "token:doom"
  | "token:endeavor"
  | "token:evasion-negative"
  | "token:evasion-positive"
  | "token:flinch"
  | "token:guilt"
  | "token:howling"
  | "token:luck-negative"
  | "token:luck-positive"
  | "token:mindlock"
  | "token:momentum"
  | "token:movement-negative"
  | "token:movement-positive"
  | "token:prep"
  | "token:priority-target"
  | "token:reroll"
  | "token:speed-negative"
  | "token:speed-positive"
  | "token:stink"
  | "token:strength-negative"
  | "token:strength-positive"
  | "token:systemic-pressure"
  | "token:torment"
  | "token:toughness-negative"
  | "token:toughness-positive"
  | "token:venom";
export type When = ("gain" | "loss" | "equip" | "limit" | "perfect-hit") | Condition;
export type GridDef =
  | {
      all?: GridProps;
      any?: GridProps;
      no?: GridProps;
      atLeast?: number;
    }
  | string
  | string[];
export type GridProps =
  | KeywordPrefixed
  | AttributePrefixed
  | {
      keywords?: Keywords1;
      [k: string]: unknown;
    };
export type KeywordPrefixed =
  | "keyword:ability"
  | "keyword:accessory"
  | "keyword:ammonia-consequence"
  | "keyword:ammunition"
  | "keyword:armor"
  | "keyword:arrow"
  | "keyword:art"
  | "keyword:axe"
  | "keyword:badge"
  | "keyword:balm"
  | "keyword:bone"
  | "keyword:bow"
  | "keyword:cleaver"
  | "keyword:cloth"
  | "keyword:club"
  | "keyword:completed-set-bonus"
  | "keyword:consumable"
  | "keyword:conviction-principle"
  | "keyword:cooking-recipe"
  | "keyword:copper"
  | "keyword:crimson-crocodile"
  | "keyword:crude"
  | "keyword:cult"
  | "keyword:dagger"
  | "keyword:deathmetal"
  | "keyword:diamond"
  | "keyword:dragon-king"
  | "keyword:dung"
  | "keyword:emotion"
  | "keyword:faith"
  | "keyword:family-consequence"
  | "keyword:feather"
  | "keyword:fighting-art"
  | "keyword:finesse"
  | "keyword:fish"
  | "keyword:fist-tooth"
  | "keyword:flammable"
  | "keyword:flower-knight"
  | "keyword:flower"
  | "keyword:fragile"
  | "keyword:frogdog"
  | "keyword:fungus"
  | "keyword:fur"
  | "keyword:gce"
  | "keyword:gold"
  | "keyword:gorm"
  | "keyword:grand-weapon"
  | "keyword:gun"
  | "keyword:heavy"
  | "keyword:herb"
  | "keyword:hide"
  | "keyword:hollow"
  | "keyword:home"
  | "keyword:impairment"
  | "keyword:indomitable"
  | "keyword:inner-lantern-consequence"
  | "keyword:innovation"
  | "keyword:instrument"
  | "keyword:iron"
  | "keyword:item"
  | "keyword:jewelry"
  | "keyword:katana"
  | "keyword:katar"
  | "keyword:knowledge"
  | "keyword:language-consequence"
  | "keyword:lantern-oven-consequence"
  | "keyword:lantern"
  | "keyword:leather"
  | "keyword:legendary-ability"
  | "keyword:mask"
  | "keyword:melee"
  | "keyword:messenger"
  | "keyword:metal"
  | "keyword:milestone"
  | "keyword:noisy"
  | "keyword:novel"
  | "keyword:order"
  | "keyword:organ"
  | "keyword:other"
  | "keyword:oven-consequence"
  | "keyword:perfect"
  | "keyword:permanent-injury"
  | "keyword:phoenix"
  | "keyword:pickaxe"
  | "keyword:ranged"
  | "keyword:rawhide"
  | "keyword:science"
  | "keyword:scimitar"
  | "keyword:scrap"
  | "keyword:screaming-antelope"
  | "keyword:screaming-god"
  | "keyword:sculpture-consequence"
  | "keyword:scythe"
  | "keyword:secret-fighting-art"
  | "keyword:seed"
  | "keyword:set"
  | "keyword:settlement-event"
  | "keyword:shield"
  | "keyword:sickle"
  | "keyword:silk"
  | "keyword:skull"
  | "keyword:society-principle"
  | "keyword:soluble"
  | "keyword:spear"
  | "keyword:spidicules"
  | "keyword:starting-innovation"
  | "keyword:starting"
  | "keyword:stinky"
  | "keyword:stone"
  | "keyword:strain"
  | "keyword:sunstalker"
  | "keyword:survivor-status"
  | "keyword:sword"
  | "keyword:thrown"
  | "keyword:tool"
  | "keyword:two-handed"
  | "keyword:vegetable"
  | "keyword:vermin"
  | "keyword:weapon-proficiency"
  | "keyword:weapon"
  | "keyword:whip"
  | "keyword:white-lion";
/**
 * @minItems 2
 */
export type Keywords1 = Keyword[];
export type HitLocation = "head" | "arms" | "body" | "waist" | "legs" | "random";
export type MonsterTypes = "quarry" | "nemesis" | "core" | "finale";
export type Phases = "showdown" | "hunt" | "settlement";
export type Status =
  | "acted"
  | "alive"
  | "blind-spot"
  | "blind"
  | "can-intimacy"
  | "can-partnership"
  | "catalyze"
  | "cease-to-exist"
  | "dead"
  | "deaf"
  | "death-count"
  | "departing"
  | "frenzied"
  | "insane"
  | "knocked-down"
  | "not-threat"
  | "removed"
  | "retired"
  | "returning"
  | "skip-next-hunt"
  | "standing"
  | "stinky"
  | "terrified";
export type Targets =
  | ("hunters" | "survivors" | "self" | "other-hunters" | "monster" | "settlement")
  | {
      grid?: GridDef;
    };
export type PayloadItem =
  | PayloadKeys
  | {
      [k: string]: MathItem;
    };
export type PayloadKeys =
  | AttributePrefixed
  | GlossaryPrefixed
  | KeywordPrefixed
  | RequirePrefixed
  | RulePrefixed
  | StatusPrefixed
  | SurvivalPrefixed
  | TokenPrefixed
  | VarPrefixed
  | string;
export type GlossaryPrefixed = "glossary:activation" | "glossary:movement" | "glossary:ignore-hit" | "glossary:bash";
export type RequirePrefixed = "require:cooling" | "require:heat";
export type RulePrefixed =
  | "rule:accessory"
  | "rule:activation-limit"
  | "rule:ammo-bow"
  | "rule:ballad"
  | "rule:barbed"
  | "rule:blindside"
  | "rule:block"
  | "rule:center"
  | "rule:cumbersome"
  | "rule:cursed"
  | "rule:deadly"
  | "rule:devastating"
  | "rule:frail"
  | "rule:irreplaceable"
  | "rule:outfit"
  | "rule:paired"
  | "rule:perfection"
  | "rule:precision"
  | "rule:razor-sharp"
  | "rule:range"
  | "rule:reach"
  | "rule:refined"
  | "rule:savage"
  | "rule:sentient"
  | "rule:sharp"
  | "rule:slow"
  | "rule:unique"
  | "rule:unwieldy";
export type VarPrefixed = "var:block" | "var:counter";
export type MathItem = number | ("x" | "1d10" | "1d6" | "1d5" | "2d10" | "all") | AttributePrefixed | Calc;
export type Suffer =
  | "attr:brain-damage"
  | "attr:damage"
  | "glossary:bash"
  | "severe:dismembered-arm"
  | "severe:dismembered-leg"
  | "severe:intracranial-hemorrhage"
  | "trauma:frenzy";
export type Preventable = "principle:death" | "survival:dodge" | "rule:block" | "token:deflect" | "glossary:ignore-hit";
export type Placement = ("center" | "edge" | "anywhere") | (number | ("monster" | "edge" | "terrain") | string)[];
export type XNum = "x" | number;
export type CardDraw =
  | "x"
  | DeckPrefixed
  | {
      [k: string]: string | MathItem;
    };
export type DeckPrefixed =
  | "deck:character"
  | "deck:disorder"
  | "deck:fighting-art"
  | "deck:hunt-event"
  | "deck:innovation"
  | "deck:resource-basic"
  | "deck:resource-crimson-crocodile"
  | "deck:resource-dragon-king"
  | "deck:resource-dung-beetle-knight"
  | "deck:resource-flower-knight"
  | "deck:resource-frogdog"
  | "deck:resource-gorm"
  | "deck:resource-indomitable"
  | "deck:resource-king"
  | "deck:resource-lion-god"
  | "deck:resource-parasite-queen"
  | "deck:resource-phoenix"
  | "deck:resource-screaming-antelope"
  | "deck:resource-screaming-god"
  | "deck:resource-smog-singers"
  | "deck:resource-spidicules"
  | "deck:resource-strange"
  | "deck:resource-sunstalker"
  | "deck:resource-vermin"
  | "deck:resource-white-lion"
  | "deck:settlement-event"
  | "deck:tactic"
  | "deck:terrain";
export type Addition =
  | string
  | {
      /**
       * This interface was referenced by `undefined`'s JSON-Schema definition
       * via the `patternProperty` "^(se|story):".
       */
      [k: string]:
        | MathItem
        | {
            offset?: MathItem;
            year?: number;
          };
    };
/**
 * @minItems 2
 */
export type Additions = Addition[];
export type Prompt = Prompt1 & {
  r?: number | number[];
  q?: string;
  type?: "scavenge" | "intimacy";
  select?: Targets;
  multiple?: boolean;
  when?: When;
  yes?: Hook;
  no?: Hook;
  hook?: Hook;
  hooks?: Hooks;
  prompt?: Prompt;
  prompts?: Prompts;
};
export type Prompt1 = {
  [k: string]: unknown;
};
export type Hooks = (string | Hook)[];
/**
 * @minItems 2
 */
export type Prompts = Prompt[];
export type PerDef =
  | Per
  | {
      [k: string]: XNum;
    };
export type Per = "campaign" | "round" | "showdown" | "hunt" | "year" | "lifetime";
export type ActionTypes = "maneuver";
export type Nodes = 1 | 2 | 3 | 4;
/**
 * @minItems 1
 */
export type Costs = (
  | ("activate" | "movement" | "endeavor")
  | {
      node?: Nodes;
      gear?: string;
      keyword?: Keyword;
      /**
       * @minItems 2
       */
      keywords?: Keyword[];
      resource?: string;
      token?: "endeavor";
      x?: number;
    }
)[];
export type EntityScopes = "survivor" | "arc" | "hunter" | "wanderer" | "settlement" | "monster" | "global" | "gear" | "payload";
export type Sources =
  | "butcher"
  | "core"
  | "dragon-king"
  | "dung-beetle-knight"
  | "flower-knight"
  | "gce"
  | "gigalion"
  | "godhand"
  | "gold-smoke-knight"
  | "the-king"
  | "kings-man"
  | "lion-god"
  | "lion-knight"
  | "manhunter"
  | "parasite-queen"
  | "pariah"
  | "phoenix"
  | "screaming-antelope"
  | "screaming-god"
  | "spidicules"
  | "tyrant"
  | "watcher"
  | "white-lion";
export type ResourceTypes = "indomitable" | "basic" | "monster" | "strange" | "vermin";
export type Rule =
  | "accessory"
  | "activation-limit"
  | "ammo-bow"
  | "ballad"
  | "barbed"
  | "blindside"
  | "block"
  | "center"
  | "cumbersome"
  | "cursed"
  | "deadly"
  | "devastating"
  | "frail"
  | "irreplaceable"
  | "outfit"
  | "paired"
  | "perfection"
  | "precision"
  | "razor-sharp"
  | "range"
  | "reach"
  | "refined"
  | "savage"
  | "sentient"
  | "sharp"
  | "slow"
  | "unique"
  | "unwieldy";
export type Affinity = "red" | "green" | "blue" | "all";

export interface KingdomDeathMonsterSchema {
  $schema?: string;
  ability?: {
    [k: string]: NameDesc;
  };
  action?: {
    [k: string]: ActionDef;
  };
  attribute?: {
    [k: string]: AttributeItem;
  };
  campaign?: {
    [k: string]: BaseItem;
  };
  character?: {
    [k: string]: NameDesc;
  };
  deck?: {
    [k: string]: Decks;
  };
  disorder?: {
    [k: string]: BaseItem;
  };
  fightingArt?: {
    [k: string]: BaseItem;
  };
  gear?: {
    [k: string]: GearItem;
  };
  glossary?: {
    [k: string]: NameDesc;
  };
  huntEvent?: {
    [k: string]: BaseItem;
  };
  impairment?: {
    [k: string]: BaseItem;
  };
  injury?: {
    [k: string]: NameDesc;
  };
  innovation?: {
    [k: string]: BaseItem;
  };
  keyword?: {
    [k: string]: NameDesc;
  };
  knowledge?: {
    [k: string]: BaseItem;
  };
  location?: {
    [k: string]: BaseItem;
  };
  milestone?: {
    [k: string]: BaseItem;
  };
  monster?: {
    [k: string]: MonsterCard;
  };
  pattern?: {
    [k: string]: PatternCard;
  };
  phase?: {
    [k: string]: NameDesc;
  };
  pillar?: {
    [k: string]: BaseItem;
  };
  principle?: {
    [k: string]: BaseItem;
  };
  proficiency?: {
    [k: string]: ProficiencyCard;
  };
  require?: {
    [k: string]: NameDesc;
  };
  resource?: {
    [k: string]: ResourceCard;
  };
  rule?: {
    [k: string]: BaseItem;
  };
  seed?: {
    [k: string]: PatternCard;
  };
  set?: {
    [k: string]: BaseItem;
  };
  settlementEvent?: {
    [k: string]: BaseItem;
  };
  severe?: {
    [k: string]: BaseItem;
  };
  status?: {
    [k: string]: BaseItem;
  };
  story?: {
    [k: string]: BaseItem;
  };
  survival?: {
    [k: string]: BaseItem;
  };
  terrain?: {
    [k: string]: TerrainCard;
  };
  token?: {
    [k: string]: BaseItem;
  };
  trauma?: {
    [k: string]: BaseItem;
  };
  type?: {
    [k: string]: NameDesc;
  };
  variant?: {
    [k: string]: BaseItem;
  };
  vermin?: {
    [k: string]: BaseItem;
  };
  vignette?: {
    [k: string]: VignetteSurvivor;
  };
  var?: {
    [k: string]: NameDesc;
  };
  accessory?: ContentItem;
  bundle?: ContentItem;
  content?: ContentItem;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^ability:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^character:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^glossary:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^injury:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^keyword:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^phase:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^require:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^type:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^var:".
 */
export interface NameDesc {
  name: string;
  description?: string;
  keywords?: Keywords;
  hook?: Hook;
  hooks?: Hooks;
}
export interface Hook {
  can?: CanHook;
  on?: OnHook | AttributePrefixed | StatusPrefixed | TokenPrefixed | string;
  when?: When;
  listen?: "all" | "others" | "self" | "monster";
  gain?: PayloadItem | PayloadItem[];
  lose?: PayloadItem | PayloadItem[];
  suffer?:
    | Suffer
    | Suffer[]
    | {
        [k: string]: MathItem;
      };
  archive?:
    | boolean
    | string
    | 1
    | {
        [k: string]: "all" | number;
      };
  /**
   * @minItems 2
   */
  archives?: StatusPrefixed[];
  disable?: boolean;
  /**
   * @minItems 2
   */
  disables?: KeywordPrefixed[];
  prevent?: boolean | Preventable;
  /**
   * @minItems 2
   */
  prevents?: Preventable[];
  placement?: Placement;
  ignore?: RulePrefixed;
  insane?: boolean;
  multiply?: number;
  duration?: "round" | "phase";
  wound?: XNum;
  atLeast?: number | AttributePrefixed;
  fn?: "epimorphosis" | "equipArmor";
  tip?: string;
  draw?: CardDraw;
  /**
   * @minItems 2
   */
  draws?: CardDraw[];
  this?: {
    [k: string]: unknown;
  };
  set?: {
    [k: string]: string | number;
  };
  add?: Addition;
  adds?: Additions;
  target?: Targets;
  prompt?: Prompt;
  prompts?: Prompts;
  per?: PerDef;
  TODO?: string;
}
export interface Condition {
  id?: string;
  count?: number;
  grid?: GridDef;
  "hit-location"?: HitLocation;
  innovation?: string;
  ability?: string;
  keyword?: Keyword;
  /**
   * @minItems 2
   */
  keywords?: Keyword[];
  monster?: MonsterTypes;
  phase?: Phases;
  status?: Status;
  target?: Targets;
  change?: "gain" | "loss";
  not?: StatusPrefixed;
  /**
   * @minItems 2
   */
  and?: Condition[];
  /**
   * @minItems 2
   */
  or?: (Condition | string)[];
  [k: string]:
    | number
    | "puzzle"
    | {
        atLeast?: number;
        atMost?: number;
      }
    | string
    | GridDef
    | HitLocation
    | Keyword
    | Keyword[]
    | MonsterTypes
    | Phases
    | Status
    | Targets
    | "gain"
    | "loss"
    | StatusPrefixed
    | Condition[]
    | (Condition | string)[]
    | undefined;
}
export interface Calc {
  /**
   * @minItems 2
   * @maxItems 2
   */
  "/"?: MathItem[];
  /**
   * @minItems 2
   */
  "+"?: MathItem[];
  rounding?: "down" | "up";
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^action:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^action:".
 */
export interface ActionDef {
  name?: string;
  description?: string;
  type?: ActionTypes;
  cost: Costs;
  optional?: Costs;
  select?: Targets;
  require?: string | Condition | RequirePrefixed;
  gear?: string;
  limit?: number;
  when?: When;
  per?: PerDef;
  prompt?: Prompt;
  prompts?: Prompts;
  hook?: Hook;
  hooks?: Hooks;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^attr:".
 */
export interface AttributeItem {
  name: string;
  alt?: string;
  base:
    | number
    | {
        [k: string]: number;
      };
  min?: number;
  description?: string;
  /**
   * @minItems 1
   */
  scopes: EntityScopes[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^campaign:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^disorder:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^fa:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^he:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^impairment:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^innovation:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^knowledge:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^location:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^milestone:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^pillar:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^principle:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^rule:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^set:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^se:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^severe:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^status:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^story:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^survival:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^token:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^trauma:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^variant:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^vermin:".
 */
export interface BaseItem {
  name: string;
  description?: string;
  icon?:
    | string
    | {
        "game-icons": string;
        rotate?: string;
      };
  source?: Sources;
  type?: "normal" | "special" | "strain";
  flavor?: string;
  effect?: string;
  highlight?: string;
  page?: string;
  pillar?: number;
  limit?: number;
  consequences?: boolean;
  numerical?: boolean;
  permanent?: boolean;
  keywords?: Keywords;
  action?: {
    [k: string]: ActionDef;
  };
  hook?: Hook;
  hooks?: Hooks;
  prompt?: Prompt;
  prompts?: Prompts;
  when?: Condition;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^deck:".
 */
export interface Decks {
  name: string;
  type: ResourceTypes | "terrain";
  cards: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^(resource|terrain):".
     */
    [k: string]: number;
  };
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^gear:".
 */
export interface GearItem {
  name: string;
  alt?: string;
  source?: Sources;
  description?: string;
  icon?: string;
  type?: "rare" | "pattern" | "seed" | "starting";
  keywords?: Keywords;
  rules?: (
    | Rule
    | {
        [k: string]: number;
      }
  )[];
  attributes?: {
    "armor-any"?: number;
    "armor-head"?: number;
    "armor-arms"?: number;
    "armor-body"?: number;
    "armor-waist"?: number;
    "armor-legs"?: number;
    speed?: number;
    accuracy?: number;
    strength?: number;
    luck?: number;
    evasion?: number;
  };
  affinities?: {
    top?: Affinity;
    right?: Affinity;
    bottom?: Affinity;
    left?: Affinity;
  };
  hook?: Hook;
  hooks?: Hooks;
  prompt?: Prompt;
  prompts?: Prompts;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^monster:".
 */
export interface MonsterCard {
  name: string;
  type: MonsterTypes;
  node?: Nodes;
  description: string;
  size?: "1x1" | "2x2" | "3x3" | "4x4" | "2x1" | "1x3" | "1x4" | "2x3";
  /**
   * @minItems 1
   */
  levels: {
    level: number;
    b: number;
    a: number;
    l?: number;
    movement: number | "∞";
    toughness: number;
    speed?: number;
    damage?: number;
    tokens?: {
      accuracy?: number;
      luck?: number;
    };
    s?: string[];
    hunt?: number;
    hook?: Hook;
    hooks?: Hooks;
  }[];
  /**
   * @minItems 13
   * @maxItems 13
   */
  "hunt-board"?: (0 | 1 | 2 | 3 | "E")[];
  placement: Placement;
  hook?: Hook;
  hooks?: Hooks;
  instinct: {
    name: string;
    description: string;
    prompt?: Prompt;
    hook?: Hook;
  };
  action?: (
    | "-▼-"
    | string
    | {
        /**
         * @minItems 2
         */
        pick?: string[];
        "move-attack"?: MonsterAttackProfile;
        "move-sync"?: MonsterAttackProfile;
      }
  )[];
}
export interface MonsterAttackProfile {
  speed: number;
  range?: number | "∞";
  accuracy: number | "∞";
  damage: number | "∞";
  "after-damage"?: string;
  hook?: Hook;
  prompt?: Prompt;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^pattern:".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^seed:".
 */
export interface PatternCard {
  name: string;
  keywords: Keywords;
  limit: number;
  num?: number;
  source?: Sources;
  era?: Nodes;
  icon?: string;
  cost: Costs;
  /**
   * @minItems 3
   * @maxItems 3
   */
  steps?: {
    color: "gray" | "blue" | "purple";
    icon: "anvil" | "triangle" | "hand" | "bucket" | "bubbles" | "snap" | "circle";
    verb: string;
    flavor: string;
    step: string;
    when?: Condition;
  }[];
  hook?: Hook;
  hooks?: Hooks;
  prompt?: Prompt;
  prompts?: Prompts;
  when?: Condition;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^proficiency:".
 */
export interface ProficiencyCard {
  name: string;
  specialization: string;
  mastery: string;
  source?: Sources;
  novel?: boolean;
  keywords: Keywords;
  hooks: ("TODO" | Hook)[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^resource:".
 */
export interface ResourceCard {
  name: string;
  type: ResourceTypes;
  source?: Sources;
  flavor?: string;
  description?: string;
  icon?: string;
  keywords: Keywords;
  hook?: Hook;
  hooks?: Hooks;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^terrain:".
 */
export interface TerrainCard {
  name: string;
  source?:
    | "butcher"
    | "core"
    | "dragon-king"
    | "dung-beetle-knight"
    | "flower-knight"
    | "gce"
    | "gigalion"
    | "godhand"
    | "gold-smoke-knight"
    | "the-king"
    | "kings-man"
    | "lion-god"
    | "lion-knight"
    | "manhunter"
    | "parasite-queen"
    | "pariah"
    | "phoenix"
    | "screaming-antelope"
    | "screaming-god"
    | "spidicules"
    | "tyrant"
    | "watcher"
    | "white-lion";
  size: "1x1" | "2x2" | "3x3" | "4x4" | "2x1" | "1x3" | "1x4" | "2x3";
  amount?: number | ("x" | "1d10" | "1d6" | "1d5" | "2d10" | "all") | AttributePrefixed | Calc;
  cost?: Costs;
  description?: string;
  placement: Placement;
  setup?: string;
  rules?: ("destructible" | "impassable" | "indestructible" | "monster-impassable" | "obstacle")[];
  hook?: Hook;
  hooks?: Hooks;
  prompt?: Prompt;
  prompts?: Prompts;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^vignette:".
 */
export interface VignetteSurvivor {
  name: string;
  description: string;
  source: Sources;
  year: number;
  /**
   * @minItems 10
   * @maxItems 10
   */
  grid?: (string | 0)[];
  survival?: {
    dodge?: number;
    encourage?: number;
    dash?: number;
    surge?: number;
  };
  attributes: {
    insanity?: number;
    "hunt-xp"?: number;
    "armor-all"?: number;
    "armor-head"?: number;
    "armor-arms"?: number;
    "armor-body"?: number;
    "armor-waist"?: number;
    "armor-legs"?: number;
    survival: number;
    movement?: number;
    accuracy?: number;
    strength?: number;
    evasion?: number;
    luck?: number;
    speed?: number;
    courage?: number;
    understanding?: number;
    proficiency?: number;
    "survival-dodge"?: number;
    "survival-encourage"?: number;
    "survival-dash"?: number;
    "survival-surge"?: number;
  };
  hook?: Hook;
  hooks?: Hooks;
}
export interface ContentItem {
  /**
   * This interface was referenced by `ContentItem`'s JSON-Schema definition
   * via the `patternProperty` "^[0-9a-z-:]+$".
   */
  [k: string]: {
    name: string;
    alt?: string;
    beta?: boolean;
    gameplay?: boolean;
    url?: string;
    date?: string;
    tags: unknown[];
    versions?: string[];
    warehouses?: string[];
    includes?: string[];
    prices?: number[];
    /**
     * @maxItems 2
     */
    colors?: string[];
  };
}
