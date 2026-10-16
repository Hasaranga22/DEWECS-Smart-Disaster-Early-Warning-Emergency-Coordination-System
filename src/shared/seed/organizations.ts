import type { Organization } from '../domain';
import { seedId } from './ids';

export const ORGANIZATIONS: Organization[] = [
  { id: seedId(3, 1), name: 'Sri Lanka Red Cross Society', type: 'NGO', coordinatorName: 'Nimali Perera', coordinatorPhone: '+94711000001', coordinatorEmail: 'redcross@example.lk' },
  { id: seedId(3, 2), name: 'Sri Lanka Army Disaster Response', type: 'ARMED_FORCES', coordinatorName: 'Maj. Ranjan Silva', coordinatorPhone: '+94711000002', coordinatorEmail: 'army-dr@example.lk' },
  { id: seedId(3, 3), name: 'Colombo District Secretariat', type: 'GOVERNMENT', coordinatorName: 'Kamal Fernando', coordinatorPhone: '+94711000003', coordinatorEmail: 'colombo-ds@example.lk' },
  { id: seedId(3, 4), name: 'Hemas Relief Foundation', type: 'PRIVATE_DONOR', coordinatorName: 'Dilini Jayawardena', coordinatorPhone: '+94711000004', coordinatorEmail: 'relief@example.lk' },
];