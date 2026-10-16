import type { AlertReader, HazardAlert, Filter, HazardType, AlertSeverity } from '@/shared/contracts/types'

export class InMemoryAlertReader implements AlertReader {
  private data: HazardAlert[] = []

  async listAlerts(_filter: Filter): Promise<HazardAlert[]> {
    return this.data
  }

  seed(rows: HazardAlert[]) {
    this.data = rows
  }

  clear() {
    this.data = []
  }

  // Test helper to add a single alert
  add(alert: HazardAlert) {
    this.data.push(alert)
  }
}
