export class ValidationError extends Error {
  public fields: string[]

  constructor(fields: string[]) {
    super(`Validation failed: ${fields.join(', ')}`)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

export class AggregationTimeoutError extends Error {
  public elapsedMs: number

  constructor(elapsedMs: number) {
    super(`Aggregation timeout after ${elapsedMs}ms`)
    this.name = 'AggregationTimeoutError'
    this.elapsedMs = elapsedMs
  }
}

export class NotFoundError extends Error {
  public resource: string
  public id: string

  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`)
    this.name = 'NotFoundError'
    this.resource = resource
    this.id = id
  }
}

export class PdfExportError extends Error {
  public reportId: string
  public cause?: string

  constructor(reportId: string, cause?: string) {
    super(`PDF export failed for report ${reportId}`)
    this.name = 'PdfExportError'
    this.reportId = reportId
    this.cause = cause
  }
}

export class ForbiddenError extends Error {
  public role: string
  public action: string

  constructor(role: string, action: string) {
    super(`Role ${role} cannot perform ${action}`)
    this.name = 'ForbiddenError'
    this.role = role
    this.action = action
  }
}
