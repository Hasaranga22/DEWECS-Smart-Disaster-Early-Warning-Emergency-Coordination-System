import type { AttemptReader, NotificationAttempt, Filter, HazardType, NotificationChannel, DeliveryStatus } from '@/shared/contracts/types'

export class InMemoryAttemptReader implements AttemptReader {
  private data: NotificationAttempt[] = []

  async listAttempts(_filter: Filter): Promise<NotificationAttempt[]> {
    return this.data
  }

  seed(rows: NotificationAttempt[]) {
    this.data = rows
  }

  clear() {
    this.data = []
  }

  add(attempt: NotificationAttempt) {
    this.data.push(attempt)
  }
}
