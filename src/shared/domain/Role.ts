export const ROLES = ['CITIZEN', 'DUTY_OFFICER', 'DMC_OFFICIAL', 'DISTRICT_OFFICER'] as const;
export type Role = (typeof ROLES)[number];

// Roles an Officer record can have (everyone except Citizen)
export type OfficerRole = Exclude<Role, 'CITIZEN'>;