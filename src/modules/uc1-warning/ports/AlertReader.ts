// TODO: Move to src/shared/contracts/AlertReader.ts once shared contracts package is created
import type { HazardAlert } from '../domain/HazardAlert';
import type { Filter } from './types';

export interface AlertReader {
  listAlerts(f: Filter): HazardAlert[] | Promise<HazardAlert[]>;
}
