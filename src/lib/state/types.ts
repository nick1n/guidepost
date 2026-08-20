export type EntryState = {
  owned?: boolean;
  wishlisted?: boolean;
  versions?: string[];
  editions?: string[];
  editionNumbers?: Record<string, number>;
};

export type CollectionState = Record<string, EntryState>;
