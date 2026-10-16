import { describe, it, expect, beforeEach } from "vitest";
import { OfflineActionQueue, MemoryOfflineStorage } from "../OfflineActionQueue";

describe("OfflineActionQueue pure queue logic", () => {
  let storage: MemoryOfflineStorage;
  let queue: OfflineActionQueue;

  beforeEach(() => {
    storage = new MemoryOfflineStorage();
    queue = new OfflineActionQueue(storage);
  });

  it("enqueues PENDING actions with actionId and expectedVersion", () => {
    const item = queue.enqueue("act-001", "UPDATE_OCCUPANCY", { shelterId: "s1", newCount: 50 }, 2);
    expect(item.status).toBe("PENDING");
    expect(item.actionId).toBe("act-001");
    expect(item.expectedVersion).toBe(2);

    const list = queue.getQueue();
    expect(list).toHaveLength(1);
    expect(list[0].actionId).toBe("act-001");
  });

  it("replays PENDING actions: successful action marks CONFIRMED", async () => {
    queue.enqueue("act-001", "UPDATE_OCCUPANCY", { shelterId: "s1", newCount: 50 });

    const result = await queue.replayQueue(async () => {
      return { ok: true, status: 200 };
    });

    expect(result.replayed).toBe(1);
    expect(queue.getQueue()[0].status).toBe("CONFIRMED");
  });

  it("replays PENDING actions: 409 stale version marks CONFLICT", async () => {
    queue.enqueue("act-002", "UPDATE_OCCUPANCY", { shelterId: "s1", newCount: 60 });

    const result = await queue.replayQueue(async () => {
      return { ok: false, status: 409, error: "Stale version" };
    });

    expect(result.conflicts).toBe(1);
    expect(queue.getQueue()[0].status).toBe("CONFLICT");
    expect(queue.getQueue()[0].error).toBe("Stale version");
  });

  it("clears confirmed actions from storage", () => {
    queue.enqueue("act-001", "UPDATE_OCCUPANCY", { shelterId: "s1" });
    queue.updateStatus("act-001", "CONFIRMED");

    queue.enqueue("act-002", "UPDATE_OCCUPANCY", { shelterId: "s2" });

    queue.clearConfirmed();
    const remaining = queue.getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].actionId).toBe("act-002");
  });
});
