import { Clock } from "../contracts/Clock";

/** System clock implementation for production runtime. */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
