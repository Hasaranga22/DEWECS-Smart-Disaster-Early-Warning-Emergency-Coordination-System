import { describe, expect, it } from 'vitest'

import { ValidationError } from '../domain/errors'
import { ReportFilterValidator } from '../services/ReportFilterValidator'

function fieldsOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.fields
    }
    throw error
  }
  throw new Error('expected ValidationError to be thrown')
}

const baseInput = {
  from: '2026-08-01',
  to: '2026-08-31',
  includedSections: ['ALERTS', 'REACH'],
  language: 'EN',
}

describe('ReportFilterValidator', () => {
  const validator = new ReportFilterValidator()

  it('returns typed filters with Date objects on valid input', () => {
    const result = validator.validate(baseInput)

    expect(result.from).toBeInstanceOf(Date)
    expect(result.to).toBeInstanceOf(Date)
    expect(result.from.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(result.to.toISOString()).toBe('2026-08-31T00:00:00.000Z')
    expect(result.includedSections).toEqual(['ALERTS', 'REACH'])
    expect(result.language).toBe('EN')
    expect(result.districtId).toBeUndefined()
    expect(result.hazardType).toBeUndefined()
  })

  it('passes through optional districtId and hazardType', () => {
    const result = validator.validate({
      ...baseInput,
      districtId: '3f1d3e0a-8f5e-4a2b-9c7d-1e2f3a4b5c6d',
      hazardType: 'FLOOD',
    })

    expect(result.districtId).toBe('3f1d3e0a-8f5e-4a2b-9c7d-1e2f3a4b5c6d')
    expect(result.hazardType).toBe('FLOOD')
  })

  it('accepts exactly 365 days range', () => {
    const result = validator.validate({
      ...baseInput,
      from: '2025-08-01',
      to: '2026-08-01',
    })

    expect(result.from).toBeInstanceOf(Date)
  })

  it('rule 1: throws ValidationError [from, to] when dates are missing', () => {
    expect(fieldsOf(() => validator.validate({ includedSections: ['ALERTS'], language: 'EN' }))).toEqual([
      'from',
      'to',
    ])
    expect(fieldsOf(() => validator.validate({}))).toEqual(['from', 'to'])
    expect(fieldsOf(() => validator.validate(null))).toEqual(['from', 'to'])
    expect(
      fieldsOf(() => validator.validate({ from: '2026-08-01', includedSections: ['ALERTS'], language: 'EN' })),
    ).toEqual(['from', 'to'])
  })

  it('rule 2: throws ValidationError [from] when from is after to', () => {
    expect(fieldsOf(() => validator.validate({ ...baseInput, from: '2026-09-01' }))).toEqual(['from'])
  })

  it('rule 3: throws ValidationError [to] when range exceeds 365 days', () => {
    // 366 days: one day over the limit
    expect(fieldsOf(() => validator.validate({ ...baseInput, from: '2025-08-01', to: '2026-08-02' }))).toEqual([
      'to',
    ])
    expect(fieldsOf(() => validator.validate({ ...baseInput, from: '2025-07-01', to: '2026-08-01' }))).toEqual([
      'to',
    ])
  })

  it('rule 4: throws ValidationError [includedSections] when no sections selected', () => {
    expect(fieldsOf(() => validator.validate({ ...baseInput, includedSections: [] }))).toEqual([
      'includedSections',
    ])
  })

  it('collects fields from array-index issues (e.g. invalid enum in includedSections)', () => {
    // includedSections with invalid enum value triggers array index path
    expect(fieldsOf(() => validator.validate({ ...baseInput, includedSections: ['ALERTS', 'UNKNOWN'] }))).toEqual(['includedSections'])
  })

  it('reports shape errors for invalid enum / uuid values', () => {
    expect(fieldsOf(() => validator.validate({ ...baseInput, language: 'FR' }))).toEqual(['language'])
    expect(fieldsOf(() => validator.validate({ ...baseInput, hazardType: 'TSUNAMI' }))).toEqual(['hazardType'])
    expect(
      fieldsOf(() => validator.validate({ ...baseInput, districtId: 'not-a-uuid' })),
    ).toEqual(['districtId'])
    expect(
      fieldsOf(() => validator.validate({ ...baseInput, includedSections: ['ALERTS', 'UNKNOWN'] })),
    ).toEqual(['includedSections'])
    expect(fieldsOf(() => validator.validate({ ...baseInput, from: 'not-a-date' }))).toEqual(['from'])
  })
})
