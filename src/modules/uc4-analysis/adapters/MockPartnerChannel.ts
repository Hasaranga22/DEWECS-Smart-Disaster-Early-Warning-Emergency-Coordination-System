import type { AnalysisReport } from '../domain/AnalysisReport'
import type { Organization, PartnerChannel } from './PartnerChannel'

/** Deterministic RNG seam — tests inject a scripted sequence of values. */
export interface Rng {
  next(): number
}

/**
 * MockPartnerChannel — in-memory PartnerChannel with a configurable failure
 * rate (no network). `rng.next() < failureRate` simulates an unreachable
 * partner so tests can exercise partial-failure batches (E4 / A07).
 */
export class MockPartnerChannel implements PartnerChannel {
  constructor(private rng: Rng, private failureRate: number = 0.2) {}

  async send(report: AnalysisReport, organization: Organization): Promise<void> {
    // Simulated delivery latency.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })

    if (this.rng.next() < this.failureRate) {
      throw new Error(`Mock delivery failed for ${organization.name}`)
    }
  }
}
