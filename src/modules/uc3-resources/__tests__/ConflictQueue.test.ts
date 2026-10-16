import { describe, it, expect, beforeEach } from "vitest";
import { ConflictQueue } from "../services/ConflictQueue";
import { InMemoryConflictQueueRepository } from "../adapters/memory/InMemoryConflictQueueRepository";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { SequentialIdGenerator } from "@/shared/infra/fakes/SequentialIdGenerator";
import { NotFoundError } from "@/shared/infra/errors";

describe("ConflictQueue", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";
  const officerId = "00000000-0000-4000-8000-000000000999";

  let repo: InMemoryConflictQueueRepository;
  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let queue: ConflictQueue;

  beforeEach(() => {
    repo = new InMemoryConflictQueueRepository();
    repo.clear();
    clock = new FakeClock();
    idGen = new SequentialIdGenerator();
    queue = new ConflictQueue(repo, clock, idGen);
  });

  it("should enqueue a conflicting action with status OPEN and version details", async () => {
    const item = await queue.enqueue(
      "DISPATCH_RESCUE_TEAM",
      { districtId: colomboDistrictId, teamId: "team-123" },
      1,
      2
    );

    expect(item.id).toBeDefined();
    expect(item.actionType).toBe("DISPATCH_RESCUE_TEAM");
    expect(item.status).toBe("OPEN");
    expect(item.expectedVersion).toBe(1);
    expect(item.actualVersion).toBe(2);

    const saved = await repo.findById(item.id);
    expect(saved).not.toBeNull();
    expect(saved?.actionType).toBe("DISPATCH_RESCUE_TEAM");
  });

  it("should list open conflicts specifically filtered by district", async () => {
    await queue.enqueue("ACTION_COLOMBO", { districtId: colomboDistrictId }, 1, 2);
    await queue.enqueue("ACTION_GAMPAHA", { districtId: gampahaDistrictId }, 1, 2);

    const colomboItems = await queue.listOpen(colomboDistrictId);
    expect(colomboItems).toHaveLength(1);
    expect(colomboItems[0].actionType).toBe("ACTION_COLOMBO");

    const gampahaItems = await queue.listOpen(gampahaDistrictId);
    expect(gampahaItems).toHaveLength(1);
    expect(gampahaItems[0].actionType).toBe("ACTION_GAMPAHA");
  });

  it("should mark a conflict as RESOLVED with officer ID and timestamp", async () => {
    const item = await queue.enqueue("UPDATE_SHELTER", { districtId: colomboDistrictId }, 1, 2);

    const resolved = await queue.resolve(item.id, "DISCARD", officerId);
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedBy).toBe(officerId);
    expect(resolved.resolvedAt).toBeDefined();

    // The item should no longer appear in open conflicts
    const openItems = await queue.listOpen(colomboDistrictId);
    expect(openItems).toHaveLength(0);
  });

  it("should throw NotFoundError when resolving a non-existent conflict item", async () => {
    await expect(queue.resolve("missing-id", "RETRY", officerId)).rejects.toThrow(NotFoundError);
  });
});
