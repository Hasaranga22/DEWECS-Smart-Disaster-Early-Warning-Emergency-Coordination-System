import { describe, it, expect } from "vitest";
import { SystemClock } from "../Clock";
import { UuidGenerator } from "../IdGenerator";
import { FakeClock } from "../fakes/FakeClock";
import { SequentialIdGenerator } from "../fakes/SequentialIdGenerator";

describe("Clock and IdGenerator Infrastructure", () => {
  it("SystemClock returns current date", () => {
    const clock = new SystemClock();
    const now = clock.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThan(0);
  });

  it("UuidGenerator generates valid UUID string", () => {
    const idGen = new UuidGenerator();
    const id = idGen.next();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("FakeClock can set and advance time deterministically", () => {
    const initial = new Date("2026-10-08T12:00:00.000Z");
    const fakeClock = new FakeClock(initial);
    expect(fakeClock.now()).toEqual(initial);

    fakeClock.advance(5000);
    expect(fakeClock.now()).toEqual(new Date("2026-10-08T12:00:05.000Z"));

    const newDate = new Date("2026-10-09T00:00:00.000Z");
    fakeClock.set(newDate);
    expect(fakeClock.now()).toEqual(newDate);
  });

  it("SequentialIdGenerator generates sequential UUID-v4 formatted IDs", () => {
    const seqGen = new SequentialIdGenerator();
    const id1 = seqGen.next();
    const id2 = seqGen.next();

    expect(id1).toBe("00000000-0000-4000-8000-000000000001");
    expect(id2).toBe("00000000-0000-4000-8000-000000000002");
  });
});
