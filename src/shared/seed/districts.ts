import type { District } from '../domain';
import { seedId } from './ids';

export const D = {
  COLOMBO: seedId(1, 1),
  GAMPAHA: seedId(1, 2),
  KEGALLE: seedId(1, 3),
  KANDY: seedId(1, 4),
  GALLE: seedId(1, 5),
  RATNAPURA: seedId(1, 6),
} as const;

export const DISTRICTS: District[] = [
  { id: D.COLOMBO, name: 'Colombo' },
  { id: D.GAMPAHA, name: 'Gampaha' },
  { id: D.KEGALLE, name: 'Kegalle' },
  { id: D.KANDY, name: 'Kandy' },
  { id: D.GALLE, name: 'Galle' },
  { id: D.RATNAPURA, name: 'Ratnapura' },
];