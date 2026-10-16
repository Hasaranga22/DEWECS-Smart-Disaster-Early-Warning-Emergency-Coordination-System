import type { Clock } from '../../ports/Clock';

export class FakeClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date | string = new Date('2026-10-08T10:00:00.000Z')) {
    this.currentTime = typeof initialTime === 'string' ? new Date(initialTime) : new Date(initialTime.getTime());
  }

  public now(): Date {
    return new Date(this.currentTime.getTime());
  }

  public advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  public advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  public advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  public setTime(time: Date | string): void {
    this.currentTime = typeof time === 'string' ? new Date(time) : new Date(time.getTime());
  }
}
