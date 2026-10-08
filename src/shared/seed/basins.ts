import type { RiverBasin } from '../domain';
import { D } from './districts';
import { seedId } from './ids';

export const KELANI_BASIN_ID = seedId(2, 1);

export const RIVER_BASINS: RiverBasin[] = [
  {
    id: KELANI_BASIN_ID,
    name: 'Kelani River Basin',
    description: 'Spans Colombo, Gampaha and Kegalle',
    districtIds: [D.COLOMBO, D.GAMPAHA, D.KEGALLE],
  },
];