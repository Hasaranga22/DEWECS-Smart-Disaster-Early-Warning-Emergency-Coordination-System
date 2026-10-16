import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRepository } from "../InMemoryRepository";
import { InMemoryTransactionRunner } from "../TransactionRunner";

interface Item {
  id: string;
  count: number;
}

describe("InMemoryTransactionRunner", () => {
  let repo: InMemoryRepository<Item>;
  let runner: InMemoryTransactionRunner;

  beforeEach(() => {
    repo = new InMemoryRepository<Item>("tx_test_item");
    repo.clear();
    runner = new InMemoryTransactionRunner([repo]);
  });

  it("commits writes if transaction block succeeds", async () => {
    await repo.save({ id: "item-1", count: 10 });
    await runner.runInTransaction(async () => {
      await repo.save({ id: "item-1", count: 5 });
      await repo.save({ id: "item-2", count: 20 });
    });

    expect(await repo.findById("item-1")).toEqual({ id: "item-1", count: 5 });
    expect(await repo.findById("item-2")).toEqual({ id: "item-2", count: 20 });
  });

  it("rolls back all registered repository changes if error is thrown inside block", async () => {
    await repo.save({ id: "item-1", count: 10 });

    await expect(
      runner.runInTransaction(async () => {
        await repo.save({ id: "item-1", count: 0 });
        await repo.save({ id: "item-2", count: 100 });
        throw new Error("Forced transaction failure");
      })
    ).rejects.toThrow("Forced transaction failure");

    // Assert repository state before == after
    expect(await repo.findById("item-1")).toEqual({ id: "item-1", count: 10 });
    expect(await repo.findById("item-2")).toBeNull();
  });
});
