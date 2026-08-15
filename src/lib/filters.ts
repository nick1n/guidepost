export type SortKey = 'name' | 'price-desc' | 'price-asc';
export type GameplayFilter = 'any' | 'gameplay' | 'models';
export type KindFilter = 'any' | 'core' | 'expansion' | 'white-box' | 'beta' | 'promo' | 'set';
export type StatusFilter = 'any' | 'owned' | 'unowned' | 'wishlisted';

export type Filters = {
  query: string;
  sort: SortKey;
  gameplay: GameplayFilter;
  kind: KindFilter;
  status: StatusFilter;
  tags: string[];
};

export const defaultFilters: Filters = {
  query: '',
  sort: 'price-desc',
  gameplay: 'any',
  kind: 'any',
  status: 'any',
  tags: [],
};
