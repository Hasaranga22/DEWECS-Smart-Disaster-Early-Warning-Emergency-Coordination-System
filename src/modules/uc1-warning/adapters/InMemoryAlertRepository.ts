import type { HazardAlert, NotificationAttempt } from '../domain';
import type { AlertRepository } from './AlertRepository';

export class InMemoryAlertRepository implements AlertRepository {
  private alerts: Map<string, HazardAlert> = new Map();
  private attempts: Map<string, NotificationAttempt> = new Map();

  public async save(alert: HazardAlert): Promise<void> {
    this.alerts.set(alert.id, alert);
  }

  public async findById(id: string): Promise<HazardAlert | null> {
    const alert = this.alerts.get(id);
    return alert ?? null;
  }

  public async listAll(): Promise<HazardAlert[]> {
    return Array.from(this.alerts.values());
  }

  public async saveAttempt(attempt: NotificationAttempt): Promise<void> {
    this.attempts.set(attempt.id, attempt);
  }

  public async saveAttempts(attempts: NotificationAttempt[]): Promise<void> {
    for (const attempt of attempts) {
      this.attempts.set(attempt.id, attempt);
    }
  }

  public async findAttemptsByAlertId(alertId: string): Promise<NotificationAttempt[]> {
    return Array.from(this.attempts.values()).filter((a) => a.alertId === alertId);
  }

  public async findAttemptById(id: string): Promise<NotificationAttempt | null> {
    return this.attempts.get(id) ?? null;
  }

  public async listAllAttempts(): Promise<NotificationAttempt[]> {
    return Array.from(this.attempts.values());
  }

  public clear(): void {
    this.alerts.clear();
    this.attempts.clear();
  }
}
