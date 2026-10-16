import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRepository } from "../InMemoryRepository";

interface DummyEntity {
  id: string;
  name: string;
}

describe("InMemoryRepository", () => {
  let repo: InMemoryRepository<DummyEntity>;

  beforeEach(() => {
    repo = new InMemoryRepository<DummyEntity>("test_dummy");
    repo.clear();
  });

  it("saves and retrieves entities by id", async () => {
    await repo.save({ id: "1", name: "Alpha" });
    const item = await repo.findById("1");
    expect(item).toEqual({ id: "1", name: "Alpha" });
  });

  it("returns null for non-existent entity", async () => {
    const item = await repo.findById("999");
    expect(item).toBeNull();
  });

  it("lists all saved entities", async () => {
    await repo.save({ id: "1", name: "Alpha" });
    await repo.save({ id: "2", name: "Beta" });
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("deletes entities", async () => {
    await repo.save({ id: "1", name: "Alpha" });
    await repo.delete("1");
    expect(await repo.findById("1")).toBeNull();
  });

  it("supports snapshot and restore for rollbacks", async () => {
    await repo.save({ id: "1", name: "Initial" });
    const snap = repo.snapshot();
    await repo.save({ id: "1", name: "Updated" });
    await repo.save({ id: "2", name: "New" });

    repo.restore(snap);
    expect(await repo.findById("1")).toEqual({ id: "1", name: "Initial" });
    expect(await repo.findById("2")).toBeNull();
  });
});
