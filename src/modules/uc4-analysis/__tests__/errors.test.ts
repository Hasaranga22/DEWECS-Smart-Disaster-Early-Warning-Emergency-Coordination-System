import { describe, expect, it } from 'vitest'

import {
  ValidationError,
  AggregationTimeoutError,
  NotFoundError,
  PdfExportError,
  DuplicateSnapshotError,
  ForbiddenError,
} from '../domain/errors'

describe('domain/errors', () => {
  it('ValidationError: carries fields array', () => {
    const error = new ValidationError(['from', 'to'])
    expect(error.name).toBe('ValidationError')
    expect(error.fields).toEqual(['from', 'to'])
    expect(error.message).toBe('Validation failed: from, to')
  })

  it('AggregationTimeoutError: carries elapsedMs', () => {
    const error = new AggregationTimeoutError(42000)
    expect(error.name).toBe('AggregationTimeoutError')
    expect(error.elapsedMs).toBe(42000)
    expect(error.message).toBe('Aggregation timeout after 42000ms')
  })

  it('NotFoundError: carries resource and id', () => {
    const error = new NotFoundError('Analysis report', 'rep-1')
    expect(error.name).toBe('NotFoundError')
    expect(error.resource).toBe('Analysis report')
    expect(error.id).toBe('rep-1')
    expect(error.message).toBe('Analysis report rep-1 not found')
  })

  it('PdfExportError: carries reportId and optional cause', () => {
    const withCause = new PdfExportError('rep-1', 'render failed')
    expect(withCause.name).toBe('PdfExportError')
    expect(withCause.reportId).toBe('rep-1')
    expect(withCause.cause).toBe('render failed')
    expect(withCause.message).toBe('PDF export failed for report rep-1')

    const withoutCause = new PdfExportError('rep-2')
    expect(withoutCause.cause).toBeUndefined()
    expect(withoutCause.message).toBe('PDF export failed for report rep-2')
  })

  it('DuplicateSnapshotError: carries id', () => {
    const error = new DuplicateSnapshotError('rep-1')
    expect(error.name).toBe('DuplicateSnapshotError')
    expect(error.id).toBe('rep-1')
    expect(error.message).toBe('Snapshot rep-1 already exists — reports are write-once')
  })

  it('ForbiddenError: carries role and action', () => {
    const error = new ForbiddenError('DISTRICT_OFFICER', 'access this endpoint (requires DMC_OFFICIAL)')
    expect(error.name).toBe('ForbiddenError')
    expect(error.role).toBe('DISTRICT_OFFICER')
    expect(error.action).toBe('access this endpoint (requires DMC_OFFICIAL)')
    expect(error.message).toBe('Role DISTRICT_OFFICER cannot perform access this endpoint (requires DMC_OFFICIAL)')
  })
})
