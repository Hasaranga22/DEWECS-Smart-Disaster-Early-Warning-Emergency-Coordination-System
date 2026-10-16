import type { HazardType } from '@/shared/domain';

export const SEVERITIES = ['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const HAZARD_TYPES: HazardType[] = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'];
