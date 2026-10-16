// Matches the contract in the README. 'OTHER' is only used by ground reports, never by alerts.
export const HAZARD_TYPES = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT', 'OTHER'] as const;
export type HazardType = (typeof HAZARD_TYPES)[number];