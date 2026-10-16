export interface ReportShare {
  id: string
  reportId: string
  organizationId: string
  status: 'SENT' | 'FAILED'
  attemptedAt: Date
  actorId: string
  failureReason?: string
}
