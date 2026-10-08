import type { AlertRepository } from '../adapters/AlertRepository';
import type { HazardAlert, NotificationAttempt } from '../domain';
import type { AlertReader } from '../ports/AlertReader';
import type { AttemptReader } from '../ports/AttemptReader';
import type { Filter } from '../ports/types';
import type { BasinProvider } from './TargetResolver';

export class AlertQueryService implements AlertReader, AttemptReader {
  constructor(
    private readonly alertRepo: AlertRepository,
    private readonly basinProvider?: BasinProvider,
  ) {}

  /**
   * Lists alerts matching the specified filter criteria.
   * Every record exposes id, occurredAt, and hazardType.
   */
  public async listAlerts(filter: Filter): Promise<HazardAlert[]> {
    const allAlerts = await this.alertRepo.listAll();
    const result: HazardAlert[] = [];

    for (const alert of allAlerts) {
      if (filter.cutoff && alert.occurredAt.getTime() > filter.cutoff.getTime()) {
        continue;
      }
      if (filter.from && alert.occurredAt.getTime() < filter.from.getTime()) {
        continue;
      }
      if (filter.to && alert.occurredAt.getTime() > filter.to.getTime()) {
        continue;
      }
      if (filter.hazardType && alert.hazardType !== filter.hazardType) {
        continue;
      }
      if (filter.districtId) {
        const districtMatches = alert.target.districtIds?.includes(filter.districtId);
        let basinMatches = false;
        if (!districtMatches && alert.target.basinId && this.basinProvider) {
          const basin = await this.basinProvider.getById(alert.target.basinId);
          if (basin?.districtIds.includes(filter.districtId)) {
            basinMatches = true;
          }
        }
        if (!districtMatches && !basinMatches) {
          continue;
        }
      }

      result.push(alert);
    }

    return result;
  }

  /**
   * Lists notification attempts matching the specified filter criteria.
   * Every record exposes id, occurredAt, districtId, and hazardType.
   */
  public async listAttempts(filter: Filter): Promise<NotificationAttempt[]> {
    const allAttempts = await this.alertRepo.listAllAttempts();
    const result: NotificationAttempt[] = [];

    for (const attempt of allAttempts) {
      if (filter.cutoff && attempt.occurredAt.getTime() > filter.cutoff.getTime()) {
        continue;
      }
      if (filter.from && attempt.occurredAt.getTime() < filter.from.getTime()) {
        continue;
      }
      if (filter.to && attempt.occurredAt.getTime() > filter.to.getTime()) {
        continue;
      }
      if (filter.hazardType && attempt.hazardType !== filter.hazardType) {
        continue;
      }
      if (filter.districtId && attempt.districtId !== filter.districtId) {
        continue;
      }

      result.push(attempt);
    }

    return result;
  }
}
