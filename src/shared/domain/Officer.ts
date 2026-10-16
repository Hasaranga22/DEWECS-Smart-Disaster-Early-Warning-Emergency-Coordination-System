import type { OfficerRole } from './Role';

export interface Officer {
  id: string;
  name: string;
  role: OfficerRole;
  districtId?: string; // only District Officers are bound to a district
  phone?: string;
  email?: string;
}