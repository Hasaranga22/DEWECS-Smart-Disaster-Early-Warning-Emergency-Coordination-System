import type { Officer } from '../domain';
import { DISTRICTS } from './districts';
import { seedId } from './ids';

export const DUTY_OFFICER_ID = seedId(4, 1);
export const DMC_OFFICIAL_ID = seedId(4, 2);

export const OFFICERS: Officer[] = [
  { id: DUTY_OFFICER_ID, name: 'Duty Officer Silva', role: 'DUTY_OFFICER', email: 'duty@dmc.example.lk' },
  { id: DMC_OFFICIAL_ID, name: 'DMC Official Perera', role: 'DMC_OFFICIAL', email: 'dmc@dmc.example.lk' },
  // one District Officer per district (bound to that district)
  ...DISTRICTS.map((d, i): Officer => ({
    id: seedId(4, 10 + i),
    name: `${d.name} District Officer`,
    role: 'DISTRICT_OFFICER',
    districtId: d.id,
    email: `${d.name.toLowerCase()}.do@dmc.example.lk`,
  })),
];