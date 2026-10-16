import type { DistrictNotificationStore } from '../ports/DistrictNotificationStore';
import type { DistrictNotification } from '../ports/types';

export class InMemoryDistrictNotificationStore implements DistrictNotificationStore {
  private notifications: DistrictNotification[] = [];

  public async add(n: DistrictNotification): Promise<void> {
    this.notifications.push({ ...n });
  }

  public async listForDistrict(districtId: string): Promise<DistrictNotification[]> {
    return this.notifications.filter((n) => n.districtId === districtId);
  }

  public async listAll(): Promise<DistrictNotification[]> {
    return [...this.notifications];
  }

  public clear(): void {
    this.notifications = [];
  }
}
