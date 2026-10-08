// TODO: Move to src/shared/contracts/DistrictNotificationStore.ts once shared contracts package is created
import type { DistrictNotification } from './types';

export interface DistrictNotificationStore {
  add(n: DistrictNotification): void | Promise<void>;
  listForDistrict(districtId: string): DistrictNotification[] | Promise<DistrictNotification[]>;
  listAll?(): DistrictNotification[] | Promise<DistrictNotification[]>;
}
