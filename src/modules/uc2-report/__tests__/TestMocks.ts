import { Clock, IdGenerator } from "@/shared/contracts/Clock";
import { AuditRepository, ReportAuditEntry } from "../services/ReviewService";

export class StaticClock implements Clock {
  constructor(public currentTime = new Date("2026-01-01T12:00:00Z")) {}
  now() {
    return this.currentTime;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 1;
  next() {
    return `id-${this.counter++}`;
  }
}

export { InMemoryAuditRepository } from "../adapters/InMemoryAuditRepository";
