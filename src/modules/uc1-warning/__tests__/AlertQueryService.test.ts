import { beforeEach, describe, expect, it } from 'vitest';
import type { RiverBasin } from '@/shared/domain';
import { InMemoryAlertRepository } from '../adapters/InMemoryAlertRepository';
import { HazardAlert, NotificationAttempt } from '../domain';
import { AlertQueryService } from '../services/AlertQueryService';

describe('AlertQueryService (implementing AlertReader and AttemptReader)', () => {
  let alertRepo: InMemoryAlertRepository;
  let queryService: AlertQueryService;

  const mockBasin: RiverBasin = {
    id: 'basin-kelani',
    name: 'Kelani River Basin',
    districtIds: ['dist-colombo', 'dist-gampaha', 'dist-kegalle'],
  };

  const basinProvider = {
    getById: async (id: string) => (id === 'basin-kelani' ? mockBasin : null),
  };

  beforeEach(async () => {
    alertRepo = new InMemoryAlertRepository();
    queryService = new AlertQueryService(alertRepo, basinProvider);

    const alert1 = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Colombo flood warning',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: new Date('2026-10-08T08:00:00.000Z'),
    });

    const alert2 = new HazardAlert({
      id: 'alert-2',
      hazardType: 'LANDSLIDE',
      severity: 'WATCH',
      message: 'Kegalle landslide watch',
      target: { districtIds: ['dist-kegalle'] },
      issuedBy: 'officer-1',
      occurredAt: new Date('2026-10-08T09:00:00.000Z'),
    });

    const alert3 = new HazardAlert({
      id: 'alert-3',
      hazardType: 'FLOOD',
      severity: 'EMERGENCY',
      message: 'Kelani basin flood emergency',
      target: { basinId: 'basin-kelani' },
      issuedBy: 'officer-1',
      occurredAt: new Date('2026-10-08T10:00:00.000Z'),
    });

    await alertRepo.save(alert1);
    await alertRepo.save(alert2);
    await alertRepo.save(alert3);

    const att1 = new NotificationAttempt({
      id: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      districtId: 'dist-colombo',
      hazardType: 'FLOOD',
      channel: 'SMS',
      kind: 'ISSUE',
      occurredAt: new Date('2026-10-08T08:00:05.000Z'),
    });

    const att2 = new NotificationAttempt({
      id: 'att-2',
      alertId: 'alert-2',
      citizenId: 'cit-2',
      districtId: 'dist-kegalle',
      hazardType: 'LANDSLIDE',
      channel: 'PUSH',
      kind: 'ISSUE',
      occurredAt: new Date('2026-10-08T09:00:05.000Z'),
    });

    await alertRepo.saveAttempt(att1);
    await alertRepo.saveAttempt(att2);
  });

  it('filters alerts by date range (from, to) and cutoff', async () => {
    const alertsInRange = await queryService.listAlerts({
      from: new Date('2026-10-08T08:30:00.000Z'),
      to: new Date('2026-10-08T09:30:00.000Z'),
    });
    expect(alertsInRange).toHaveLength(1);
    expect(alertsInRange[0].id).toBe('alert-2');

    const alertsWithCutoff = await queryService.listAlerts({
      cutoff: new Date('2026-10-08T08:30:00.000Z'),
    });
    expect(alertsWithCutoff).toHaveLength(1);
    expect(alertsWithCutoff[0].id).toBe('alert-1');
  });

  it('filters alerts by hazardType', async () => {
    const landslideAlerts = await queryService.listAlerts({
      hazardType: 'LANDSLIDE',
    });
    expect(landslideAlerts).toHaveLength(1);
    expect(landslideAlerts[0].id).toBe('alert-2');
  });

  it('filters alerts by districtId, including river basin spanning districts', async () => {
    // Colombo is targeted directly by alert-1 and indirectly via basin-kelani in alert-3
    const colomboAlerts = await queryService.listAlerts({
      districtId: 'dist-colombo',
    });
    expect(colomboAlerts).toHaveLength(2);
    expect(colomboAlerts.map((a) => a.id)).toEqual(['alert-1', 'alert-3']);
  });

  it('filters notification attempts by districtId, hazardType, and date', async () => {
    const colomboAttempts = await queryService.listAttempts({
      districtId: 'dist-colombo',
    });
    expect(colomboAttempts).toHaveLength(1);
    expect(colomboAttempts[0].id).toBe('att-1');

    const landslideAttempts = await queryService.listAttempts({
      hazardType: 'LANDSLIDE',
    });
    expect(landslideAttempts).toHaveLength(1);
    expect(landslideAttempts[0].id).toBe('att-2');
  });
});
