import type { NotificationAttempt } from '@/shared/contracts/types'

// ─── Return types ─────────────────────────────────────────────────────────────

export interface ChannelStats {
  attempted: number
  delivered: number
  failed: number
}

export interface ReachMetrics {
  distinctCitizens: number
  perChannel: {
    PUSH: ChannelStats
    SMS: ChannelStats
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

const emptyChannelStats = (): ChannelStats => ({ attempted: 0, delivered: 0, failed: 0 })

/**
 * ReachCalculator (G04 fix)
 *
 * Responsibility: compute how many citizens were actually reached by a set of
 * notification attempts, plus per-channel delivery statistics.
 *
 * Critical rules:
 * - `distinctCitizens` counts each citizen at most ONCE, even when they were
 *   reached through both PUSH and SMS (COUNT(DISTINCT citizenId) WHERE
 *   deliveryStatus === 'DELIVERED' — BR3).
 * - Per-channel counts are NON-ADDITIVE: `distinctCitizens` is never the sum
 *   of `perChannel.*.delivered` (BR4).
 * - `attempted` counts ALL attempts for the channel (QUEUED/SENT/DELIVERED/
 *   FAILED); `failed` counts only FAILED.
 */
export class ReachCalculator {
  /**
   * Compute reach metrics for the given notification attempts.
   *
   * @param attempts notification attempts inside the filter window
   * @returns distinct delivered citizens + per-channel stats
   */
  compute(attempts: NotificationAttempt[]): ReachMetrics {
    // Step 1: only DELIVERED attempts prove a citizen was reached.
    const deliveredAttempts = attempts.filter(
      (attempt) => attempt.deliveryStatus === 'DELIVERED',
    )

    // Step 2: one citizen reached via two channels still counts once.
    const distinctCitizens = new Set(
      deliveredAttempts.map((attempt) => attempt.citizenId),
    ).size

    // Step 3: per-channel stats cover ALL attempts, not just delivered ones.
    const perChannel: ReachMetrics['perChannel'] = {
      PUSH: emptyChannelStats(),
      SMS: emptyChannelStats(),
    }

    for (const attempt of attempts) {
      const stats = perChannel[attempt.channel]
      stats.attempted += 1
      if (attempt.deliveryStatus === 'DELIVERED') {
        stats.delivered += 1
      } else if (attempt.deliveryStatus === 'FAILED') {
        stats.failed += 1
      }
    }

    // Step 4
    return { distinctCitizens, perChannel }
  }
}
