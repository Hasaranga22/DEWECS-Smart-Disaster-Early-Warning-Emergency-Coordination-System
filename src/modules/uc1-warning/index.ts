import { CITIZENS, D, RIVER_BASINS } from '@/shared/seed';
import type { AlertRepository } from './adapters/AlertRepository';
import type { ChannelGateway } from './adapters/ChannelGateway';
import { InMemoryAlertRepository } from './adapters/InMemoryAlertRepository';
import { InMemoryDistrictNotificationStore } from './adapters/InMemoryDistrictNotificationStore';
import { MockPushGateway } from './adapters/MockPushGateway';
import { MockSmsGateway } from './adapters/MockSmsGateway';
import type { Clock } from './ports/Clock';
import type { DistrictNotificationStore } from './ports/DistrictNotificationStore';
import type { IdGenerator } from './ports/IdGenerator';
import type { VerifiedEvidenceProvider } from './ports/VerifiedEvidenceProvider';
import type { VerifiedEvidence } from './ports/types';
import { AlertQueryService } from './services/AlertQueryService';
import { type BasinProvider, type CitizenProvider, TargetResolver } from './services/TargetResolver';
import { WarningService } from './services/WarningService';

export * from './adapters';
export * from './domain';
export * from './ports/AlertReader';
export * from './ports/AttemptReader';
export * from './ports/Clock';
export * from './ports/DistrictNotificationStore';
export * from './ports/Filter';
export * from './ports/IdGenerator';
export * from './ports/types';
export * from './ports/VerifiedEvidenceProvider';
export * from './services';

export interface Uc1ModuleDependencies {
  alertRepo?: AlertRepository;
  notificationStore?: DistrictNotificationStore;
  clock?: Clock;
  idGen?: IdGenerator;
  smsGateway?: ChannelGateway;
  pushGateway?: ChannelGateway;
  citizenProvider?: CitizenProvider;
  basinProvider?: BasinProvider;
  evidenceProvider?: VerifiedEvidenceProvider;
}

export interface Uc1Module {
  warningService: WarningService;
  queryService: AlertQueryService;
  targetResolver: TargetResolver;
  alertRepo: AlertRepository;
  notificationStore: DistrictNotificationStore;
  smsGateway: ChannelGateway;
  pushGateway: ChannelGateway;
  clock: Clock;
  idGen: IdGenerator;
  evidenceProvider?: VerifiedEvidenceProvider;
}

class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

class UuidGenerator implements IdGenerator {
  public next(): string {
    return crypto.randomUUID();
  }
}

/**
 * Composition root factory for UC1 Hazard Warning module.
 */
export function createUc1Module(deps: Uc1ModuleDependencies = {}): Uc1Module {
  const clock = deps.clock ?? new SystemClock();
  const idGen = deps.idGen ?? new UuidGenerator();
  const alertRepo = deps.alertRepo ?? new InMemoryAlertRepository();
  const notificationStore = deps.notificationStore ?? new InMemoryDistrictNotificationStore();

  const smsGateway =
    deps.smsGateway ??
    new MockSmsGateway({
      failureRate: parseFloat(process.env.SMS_FAILURE_RATE ?? '0.1'),
      clock,
    });

  const pushGateway =
    deps.pushGateway ??
    new MockPushGateway({
      failureRate: parseFloat(process.env.PUSH_FAILURE_RATE ?? '0.05'),
      clock,
    });

  const citizenProvider: CitizenProvider = deps.citizenProvider ?? {
    listAll: async () => CITIZENS,
  };

  const basinProvider: BasinProvider = deps.basinProvider ?? {
    getById: async (id: string) => RIVER_BASINS.find((b) => b.id === id) ?? null,
  };

  const targetResolver = new TargetResolver(citizenProvider, basinProvider);

  const warningService = new WarningService(
    alertRepo,
    targetResolver,
    smsGateway,
    pushGateway,
    notificationStore,
    clock,
    idGen,
  );

  const queryService = new AlertQueryService(alertRepo, basinProvider);
  const evidenceProvider =
    deps.evidenceProvider ??
    new DefaultVerifiedEvidenceProvider();

  return {
    warningService,
    queryService,
    targetResolver,
    alertRepo,
    notificationStore,
    smsGateway,
    pushGateway,
    clock,
    idGen,
    evidenceProvider,
  };
}

class DefaultVerifiedEvidenceProvider implements VerifiedEvidenceProvider {
  public async listVerified(districtId?: string): Promise<VerifiedEvidence[]> {
    const list: VerifiedEvidence[] = [
      {
        reportId: 'rep-001',
        hazardType: 'FLOOD',
        districtId: D.COLOMBO,
        lat: 6.9271,
        lng: 79.8612,
        severityIndication: 'HIGH',
        confidence: 'FULL',
        corroborationCount: 3,
        decidedAt: new Date('2026-10-08T09:30:00.000Z'),
        occurredAt: new Date('2026-10-08T09:15:00.000Z'),
      },
      {
        reportId: 'rep-002',
        hazardType: 'FLOOD',
        districtId: D.GAMPAHA,
        lat: 7.084,
        lng: 79.9937,
        severityIndication: 'MEDIUM',
        confidence: 'FULL',
        corroborationCount: 2,
        decidedAt: new Date('2026-10-08T09:40:00.000Z'),
        occurredAt: new Date('2026-10-08T09:20:00.000Z'),
      },
      {
        reportId: 'rep-003',
        hazardType: 'LANDSLIDE',
        districtId: D.KEGALLE,
        lat: 7.2513,
        lng: 80.3464,
        severityIndication: 'HIGH',
        confidence: 'REDUCED',
        corroborationCount: 1,
        decidedAt: new Date('2026-10-08T09:45:00.000Z'),
        occurredAt: new Date('2026-10-08T09:30:00.000Z'),
      },
    ];
    if (districtId) {
      return list.filter((r) => r.districtId === districtId);
    }
    return list;
  }
}

const g = globalThis as unknown as { uc1Module?: Uc1Module };

export function getUc1Module(): Uc1Module {
  if (!g.uc1Module) {
    g.uc1Module = createUc1Module();
  }
  return g.uc1Module;
}

