import { z } from 'zod'

import { ValidationError } from '../domain/errors'
import type { HazardType, IncludedSection, Language } from '../domain/ReportFilters'

// ─── Return type ──────────────────────────────────────────────────────────────

export type ValidatedFilters = {
  from: Date
  to: Date
  districtId?: string
  hazardType?: HazardType
  includedSections: IncludedSection[]
  language: Language
}

// ─── Schema constants ─────────────────────────────────────────────────────────

const HAZARD_TYPES = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT', 'OTHER'] as const satisfies readonly HazardType[]

const INCLUDED_SECTIONS = [
  'ALERTS',
  'REACH',
  'REPORTS',
  'SHELTERS',
  'SUPPLIES',
] as const satisfies readonly IncludedSection[]

const LANGUAGES = ['EN', 'SI', 'TA'] as const satisfies readonly Language[]

/** Multi-year ranges time out aggregation — BR11. */
const MAX_RANGE_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** ISO date ('YYYY-MM-DD') or ISO datetime string → Date. */
const isoDateField = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((value) => new Date(value))

const reportFilterSchema = z.object({
  from: isoDateField,
  to: isoDateField,
  districtId: z.uuid().optional(),
  hazardType: z.enum(HAZARD_TYPES).optional(),
  // Non-emptiness is enforced by ordered rule 4 (after rules 2–3), so the
  // schema only checks the element enum here.
  includedSections: z.array(z.enum(INCLUDED_SECTIONS)),
  language: z.enum(LANGUAGES),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Unique top-level field names from zod issues, in first-seen order. */
function collectFields(error: z.ZodError): string[] {
  const fields: string[] = []
  for (const issue of error.issues) {
    const key = issue.path[0]
    const field = typeof key === 'string' ? key : 'input'
    if (!fields.includes(field)) {
      fields.push(field)
    }
  }
  return fields.length > 0 ? fields : ['input']
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ReportFilterValidator
 *
 * Responsibility: turn untrusted report-filter input (API body, query params,
 * UI state) into a fully typed {@link ValidatedFilters}, or reject it with a
 * typed {@link ValidationError} listing the offending fields.
 *
 * Rules are applied in a fixed order so the field list reported to the user is
 * deterministic when several problems exist at once:
 *   1. `from` / `to` missing  → ValidationError(['from', 'to'])
 *   2. `from` after `to`      → ValidationError(['from'])
 *   3. range > 365 days       → ValidationError(['to'])
 *   4. no sections selected   → ValidationError(['includedSections'])
 *
 * An empty period (from ≤ to, within the limit) is valid — see BR7.
 */
export class ReportFilterValidator {
  /**
   * Validate raw filter input.
   *
   * @param input unknown — request body / query params / UI state
   * @returns typed filters with `from` / `to` as `Date` objects
   * @throws ValidationError with the list of offending field names
   */
  validate(input: unknown): ValidatedFilters {
    const raw: Record<string, unknown> = isRecord(input) ? input : {}

    // Rule 1 (first: takes precedence over any other shape error).
    if (raw.from === undefined || raw.from === null || raw.to === undefined || raw.to === null) {
      throw new ValidationError(['from', 'to'])
    }

    const parsed = reportFilterSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(collectFields(parsed.error))
    }

    const { from, to, districtId, hazardType, includedSections, language } = parsed.data

    // Rule 2: start must not be after end (same instant is allowed).
    if (from.getTime() > to.getTime()) {
      throw new ValidationError(['from'])
    }

    // Rule 3: performance limit — multi-year ranges time out aggregation.
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * MS_PER_DAY) {
      throw new ValidationError(['to'])
    }

    // Rule 4: at least one section must be included.
    if (includedSections.length === 0) {
      throw new ValidationError(['includedSections'])
    }

    const filters: ValidatedFilters = { from, to, includedSections, language }
    if (districtId !== undefined) {
      filters.districtId = districtId
    }
    if (hazardType !== undefined) {
      filters.hazardType = hazardType
    }
    return filters
  }
}
