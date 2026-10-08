export interface PartnerDispatchNotification {
  teamId: string;
  teamName: string;
  organizationId: string;
  destinationDistrictId: string;
  incident?: string;
  actorId: string;
  timestamp: Date;
}

export interface PartnerNotifier {
  notifyPartnerDispatch(notification: PartnerDispatchNotification): Promise<void>;
}

export class LoggingPartnerNotifier implements PartnerNotifier {
  public readonly loggedNotifications: PartnerDispatchNotification[] = [];

  public async notifyPartnerDispatch(notification: PartnerDispatchNotification): Promise<void> {
    this.loggedNotifications.push(notification);
  }
}
