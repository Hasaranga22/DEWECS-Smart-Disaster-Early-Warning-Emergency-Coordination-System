export const ORGANIZATION_TYPES = ['GOVERNMENT', 'ARMED_FORCES', 'NGO', 'PRIVATE_DONOR'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  coordinatorName?: string;
  coordinatorPhone?: string;
  coordinatorEmail?: string;
}