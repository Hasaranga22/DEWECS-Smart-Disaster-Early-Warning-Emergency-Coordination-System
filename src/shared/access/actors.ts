import type { Role } from '../domain';
import { CITIZENS, D, DMC_OFFICIAL_ID, DUTY_OFFICER_ID, OFFICERS } from '../seed';

export interface Actor {
  id: string;
  role: Role;
  userId: string;
  name: string;
  districtId?: string;
}

const districtOfficer = OFFICERS.find((o) => o.role === 'DISTRICT_OFFICER' && o.districtId === D.COLOMBO)!;

/** One seeded demo user per switcher role. */
export const DEMO_ACTORS: Record<Role, Actor> = {
  CITIZEN: { id: CITIZENS[0].id, role: 'CITIZEN', userId: CITIZENS[0].id, name: CITIZENS[0].name, districtId: CITIZENS[0].districtId },
  DUTY_OFFICER: { id: DUTY_OFFICER_ID, role: 'DUTY_OFFICER', userId: DUTY_OFFICER_ID, name: 'Duty Officer Silva' },
  DMC_OFFICIAL: { id: DMC_OFFICIAL_ID, role: 'DMC_OFFICIAL', userId: DMC_OFFICIAL_ID, name: 'DMC Official Perera' },
  DISTRICT_OFFICER: {
    id: districtOfficer.id,
    role: 'DISTRICT_OFFICER',
    userId: districtOfficer.id,
    name: districtOfficer.name,
    districtId: districtOfficer.districtId,
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: 'Citizen',
  DUTY_OFFICER: 'Duty Officer',
  DMC_OFFICIAL: 'DMC Official',
  DISTRICT_OFFICER: 'District Officer',
};