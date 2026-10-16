export interface ChannelStats {
  attempted: number
  delivered: number
  failed: number
}

export interface Metrics {
  alerts: {
    total: number
    bySeverity: Record<string, number>
    byHazardType: Record<string, number>
  }
  reach: {
    distinctCitizens: number
    perChannel: {
      PUSH: ChannelStats
      SMS: ChannelStats
    }
  }
  reports: {
    verified: number
    rejected: number
    pending: number
  }
  shelters: {
    activated: number
    peakOccupancy: number
    events: Array<{
      occurredAt: Date
      shelterId: string
      previousCount: number
      newCount: number
    }>
  }
  supplies: {
    byType: Record<
      string,
      {
        distributed: number
        total: number
        percent: number | null
      }
    >
  }
}
