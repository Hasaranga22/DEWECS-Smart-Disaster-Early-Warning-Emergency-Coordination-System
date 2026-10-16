import { DistrictNotification } from "./types";

/**
 * Port written by UC1 (Hazard Warning) and read by UC3 (Emergency Resources).
 * Stores notifications sent to district officers regarding hazard warnings/escalations.
 */
export interface DistrictNotificationStore {
  /**
   * Adds a new district notification entry.
   * @param notification Notification record to store
   */
  add(notification: DistrictNotification): Promise<void>;

  /**
   * Lists notifications for a given district.
   * @param districtId District ID filter
   */
  listForDistrict(districtId: string): Promise<DistrictNotification[]>;
}
