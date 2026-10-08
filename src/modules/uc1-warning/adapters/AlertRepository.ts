import type { HazardAlert, NotificationAttempt } from '../domain';

export interface AlertRepository {
  save(alert: HazardAlert): Promise<void>;
  findById(id: string): Promise<HazardAlert | null>;
  listAll(): Promise<HazardAlert[]>;
  saveAttempt(attempt: NotificationAttempt): Promise<void>;
  saveAttempts(attempts: NotificationAttempt[]): Promise<void>;
  findAttemptsByAlertId(alertId: string): Promise<NotificationAttempt[]>;
  findAttemptById(id: string): Promise<NotificationAttempt | null>;
  listAllAttempts(): Promise<NotificationAttempt[]>;
}
