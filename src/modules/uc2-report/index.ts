import { ReportRepository } from "./adapters/ReportRepository";
import { AuditRepository } from "./services/ReviewService";
import { Clock, IdGenerator } from "@/shared/contracts/Clock";
import { IdbOutboxRepository } from "./client/IdbOutboxRepository";
import { ReportValidator } from "./services/ReportValidator";
import { DuplicateDetector } from "./services/DuplicateDetector";
import { SubmissionService } from "./services/SubmissionService";
import { OutboxSyncService } from "./services/OutboxSyncService";
import { ReviewService } from "./services/ReviewService";
import { EvidenceProviderImpl } from "./services/EvidenceProviderImpl";
import { DecisionQueryService } from "./services/DecisionQueryService";

// ─── Module Dependencies ──────────────────────────────────────────────────────

/**
 * External dependencies that must be supplied by the composition root
 * (src/shared/infra/container.ts).
 * The module itself has no knowledge of which implementations are used.
 */
export interface Uc2ModuleDeps {
  reports: ReportRepository;
  audits: AuditRepository;
  clock: Clock;
  ids: IdGenerator;
}

// ─── Module Output ────────────────────────────────────────────────────────────

export interface Uc2Module {
  submissionService: SubmissionService;
  reviewService: ReviewService;
  outboxSyncService: OutboxSyncService;
  evidenceProvider: EvidenceProviderImpl;
  decisionQueryService: DecisionQueryService;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * createUc2Module
 *
 * The single composition function for UC2.
 * Called once by container.ts with the correct implementations based on
 * DATA_STORE environment variable (memory or prisma).
 *
 * No class instantiation happens anywhere else — all wiring lives here.
 */
export function createUc2Module(deps: Uc2ModuleDeps): Uc2Module {
  const { reports, audits, clock, ids } = deps;

  const outbox = new IdbOutboxRepository();
  const validator = new ReportValidator(reports, clock, ids);
  const duplicateDetector = new DuplicateDetector(reports);

  const submissionService = new SubmissionService(
    reports,
    validator,
    duplicateDetector,
    outbox,
    clock
  );

  const outboxSyncService = new OutboxSyncService(
    outbox,
    validator,
    duplicateDetector,
    reports,
    clock
  );

  const reviewService = new ReviewService(reports, audits, clock, ids);

  const evidenceProvider = new EvidenceProviderImpl(reports);

  const decisionQueryService = new DecisionQueryService(audits);

  return {
    submissionService,
    reviewService,
    outboxSyncService,
    evidenceProvider,
    decisionQueryService,
  };
}
