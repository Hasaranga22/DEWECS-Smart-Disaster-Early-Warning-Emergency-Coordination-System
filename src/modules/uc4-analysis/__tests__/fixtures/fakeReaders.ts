import type {
  AlertReader,
  AttemptReader,
  Distribution,
  DistributionReader,
  Filter,
  HazardAlert,
  NotificationAttempt,
  OccupancyEvent,
  OccupancyEventReader,
  ReportDecision,
  ReportDecisionReader,
  SupplyStock,
  SupplyStockReader,
} from '@/shared/contracts/types'

/**
 * In-memory fakes for the 5 UC4 reader contracts.
 *
 * Conventions (docs/uc4-context.md §10): no real DB, no network — every test
 * injects fakes. Each fake records the filters it received so tests can assert
 * the shared-filter guarantee, and all methods are async like the contracts.
 */

export class FakeAlertReader implements AlertReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: HazardAlert[]) {}

  async listAlerts(filter: Filter): Promise<HazardAlert[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

export class FakeAttemptReader implements AttemptReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: NotificationAttempt[]) {}

  async listAttempts(filter: Filter): Promise<NotificationAttempt[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

export class FakeDecisionReader implements ReportDecisionReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: ReportDecision[]) {}

  async listDecisions(filter: Filter): Promise<ReportDecision[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

export class FakeOccupancyReader implements OccupancyEventReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: OccupancyEvent[]) {}

  async listEvents(filter: Filter): Promise<OccupancyEvent[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

export class FakeDistributionReader implements DistributionReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: Distribution[]) {}

  async listDistributions(filter: Filter): Promise<Distribution[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

export class FakeSupplyStockReader implements SupplyStockReader {
  readonly receivedFilters: Filter[] = []

  constructor(private readonly data: SupplyStock[]) {}

  async listStocks(filter: Filter): Promise<SupplyStock[]> {
    this.receivedFilters.push(filter)
    return this.data
  }
}

/**
 * A reader whose alert query never settles — used to exercise the deadline
 * race (A06): aggregate() must throw AggregationTimeoutError instead of
 * waiting forever or returning partial results.
 */
export class SlowReader implements AlertReader {
  async listAlerts(): Promise<HazardAlert[]> {
    return new Promise<HazardAlert[]>(() => {
      /* intentionally never resolves */
    })
  }
}
