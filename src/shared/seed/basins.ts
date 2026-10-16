import type { RiverBasin } from '../domain';
import { D } from './districts';
import { seedId } from './ids';

export const KELANI_BASIN_ID = seedId(2, 1);
export const KALU_GANGA_BASIN_ID = seedId(2, 2);
export const GIN_GANGA_BASIN_ID = seedId(2, 3);
export const NILWALA_BASIN_ID = seedId(2, 4);
export const MAHAWELI_BASIN_ID = seedId(2, 5);
export const WALAWE_BASIN_ID = seedId(2, 6);
export const ATTANAGALU_OYA_BASIN_ID = seedId(2, 7);

export const RIVER_BASINS: RiverBasin[] = [
  {
    id: KELANI_BASIN_ID,
    name: 'Kelani River Basin',
    description: 'Spans Colombo, Gampaha and Kegalle',
    districtIds: [D.COLOMBO, D.GAMPAHA, D.KEGALLE],
  },
  {
    id: KALU_GANGA_BASIN_ID,
    name: 'Kalu Ganga',
    description: 'Flows through Ratnapura and Kalutara',
    districtIds: [D.RATNAPURA, D.KALUTARA],
  },
  {
    id: GIN_GANGA_BASIN_ID,
    name: 'Gin Ganga',
    description: 'Catchment across Galle district',
    districtIds: [D.GALLE],
  },
  {
    id: NILWALA_BASIN_ID,
    name: 'Nilwala',
    description: 'Flows through Matara district',
    districtIds: [D.MATARA],
  },
  {
    id: MAHAWELI_BASIN_ID,
    name: 'Mahaweli',
    description: 'Major river basin spanning central to eastern plains',
    districtIds: [
      D.KANDY,
      D.NUWARA_ELIYA,
      D.MATALE,
      D.BADULLA,
      D.POLONNARUWA,
      D.TRINCOMALEE,
    ],
  },
  {
    id: WALAWE_BASIN_ID,
    name: 'Walawe',
    description: 'Spans Sabaragamuwa, Uva and Southern provinces',
    districtIds: [D.RATNAPURA, D.MONARAGALA, D.HAMBANTOTA],
  },
  {
    id: ATTANAGALU_OYA_BASIN_ID,
    name: 'Attanagalu Oya',
    description: 'Catchment basin in Gampaha district',
    districtIds: [D.GAMPAHA],
  },
];