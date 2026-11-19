export const discoveryStatusKey = ['discovery-status'] as const;
export const candidatesKey = ['candidates'] as const;
export const matchesKey = ['matches'] as const;
export const blocksKey = ['blocks'] as const;
export const matchKey = (id: string) => ['match', id] as const;
