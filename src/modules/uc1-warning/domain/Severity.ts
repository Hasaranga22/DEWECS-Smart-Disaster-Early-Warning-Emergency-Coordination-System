export const SEVERITIES = ['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY'] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_RANK: Record<Severity, number> = {
  ADVISORY: 1,
  WATCH: 2,
  WARNING: 3,
  EMERGENCY: 4,
};

/**
 * Returns the numeric rank of a severity level (1 to 4).
 */
export function getSeverityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

/**
 * Compares two severities.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return getSeverityRank(a) - getSeverityRank(b);
}

/**
 * Returns true if candidate is strictly higher severity than current.
 */
export function isHigherSeverity(candidate: Severity, current: Severity): boolean {
  return compareSeverity(candidate, current) > 0;
}

/**
 * Returns the next higher severity level, or null if already at EMERGENCY.
 */
export function nextSeverity(severity: Severity): Severity | null {
  const currentRank = getSeverityRank(severity);
  const next = SEVERITIES.find((s) => getSeverityRank(s) === currentRank + 1);
  return next ?? null;
}

/**
 * Type guard for Severity.
 */
export function isValidSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && SEVERITIES.includes(value as Severity);
}
