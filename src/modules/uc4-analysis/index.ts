import type {
  AlertReader,
  AttemptReader,
  DistributionReader,
  OccupancyEventReader,
  ReportDecisionReader,
} from '@/shared/contracts/types'
import type { Clock, IdGenerator } from '@/shared/contracts/Clock'

import type { AuditLogger } from './adapters/AuditLogger'
import type { OrganizationReader, PartnerChannel } from './adapters/PartnerChannel'
import type { ShareLogRepository } from './adapters/ShareLogRepository'
import type { SnapshotRepository } from './adapters/SnapshotRepository'
import { AggregationService } from './services/AggregationService'
import { PdfExporter } from './services/PdfExporter'
import { ReachCalculator } from './services/ReachCalculator'
import { ReportFilterValidator } from './services/ReportFilterValidator'
import { ShareService } from './services/ShareService'
import { SnapshotService } from './services/SnapshotService'

// ─── Factory contract ─────────────────────────────────────────────────────────

/** Everything the UC4 module needs from the outside world (constructor injection). */
export interface Uc4ModuleDeps {
  snapshotRepository: SnapshotRepository
  shareLogRepository: ShareLogRepository
  alertReader: AlertReader
  attemptReader: AttemptReader
  decisionReader: ReportDecisionReader
  occupancyReader: OccupancyEventReader
  distributionReader: DistributionReader
  organizationReader: OrganizationReader
  partnerChannel: PartnerChannel
  auditLogger: AuditLogger
  clock: Clock
  idGenerator: IdGenerator
}

/** The wired UC4 services exposed to API routes. */
export interface Uc4Module {
  snapshotService: SnapshotService
  pdfExporter: PdfExporter
  shareService: ShareService
  snapshotRepository: SnapshotRepository
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * createUc4Module — composition factory for UC4 (Generate Post-Event
 * Analysis Report).
 *
 * Wires the services with constructor injection only: no service reaches
 * around its ports, and swapping the repositories/readers (memory vs prisma,
 * fakes vs real) is the composition root's job.
 */
export function createUc4Module(deps: Uc4ModuleDeps): Uc4Module {
  // Pure collaborators.
  const validator = new ReportFilterValidator()
  const reachCalculator = new ReachCalculator()

  // 5 readers + reach calculator.
  const aggregation = new AggregationService(
    deps.alertReader,
    deps.attemptReader,
    deps.decisionReader,
    deps.occupancyReader,
    deps.distributionReader,
    reachCalculator,
  )

  const snapshotService = new SnapshotService(
    validator,
    aggregation,
    deps.snapshotRepository,
    deps.auditLogger,
    deps.clock,
    deps.idGenerator,
  )

  const pdfExporter = new PdfExporter()

  const shareService = new ShareService(
    deps.snapshotRepository,
    deps.shareLogRepository,
    deps.partnerChannel,
    deps.organizationReader,
    deps.auditLogger,
    deps.clock,
    deps.idGenerator,
  )

  return {
    snapshotService,
    pdfExporter,
    shareService,
    snapshotRepository: deps.snapshotRepository,
  }
}
