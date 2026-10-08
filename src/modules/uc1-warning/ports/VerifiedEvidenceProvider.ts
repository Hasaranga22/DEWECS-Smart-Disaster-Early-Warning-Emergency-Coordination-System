// TODO: Move to src/shared/contracts/VerifiedEvidenceProvider.ts once shared contracts package is created
import type { VerifiedEvidence } from './types';

export interface VerifiedEvidenceProvider {
  listVerified(districtId?: string): VerifiedEvidence[] | Promise<VerifiedEvidence[]>;
}
