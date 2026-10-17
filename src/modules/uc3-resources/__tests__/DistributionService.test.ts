import { describe, it, expect, beforeEach } from "vitest";
import { DistributionService } from "../services/DistributionService";
import { InMemorySupplyStockRepository } from "../adapters/memory/InMemorySupplyStockRepository";
import { InMemoryDistributionRepository } from "../adapters/memory/InMemoryDistributionRepository";
import { InMemoryProcessedActionRepository } from "../adapters/memory/InMemoryProcessedActionRepository";
import { InMemoryTransactionRunner } from "@/shared/infra/TransactionRunner";
import { ProcessedActionStore } from "../services/ProcessedActionStore";
import { IdempotentCommandExecutor } from "../services/IdempotentCommandExecutor";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { SequentialIdGenerator } from "@/shared/infra/fakes/SequentialIdGenerator";
import { Actor } from "@/shared/contracts/types";
import { SupplyStock } from "../domain/entities/SupplyStock";
import { InsufficientStockError, InvalidQuantityError } from "../domain/errors";
import { NotFoundError } from "@/shared/infra/errors";

describe("DistributionService", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const govOrgId = "00000000-0000-4000-8000-000000000100";

  const colomboOfficer: Actor = {
    id: "00000000-0000-4000-8000-000000000999",
    role: "DISTRICT_OFFICER",
    districtId: colomboDistrictId,
  };

  let stockRepo: InMemorySupplyStockRepository;
  let distRepo: InMemoryDistributionRepository;
  let actionRepo: InMemoryProcessedActionRepository;
  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let service: DistributionService;

  beforeEach(() => {
    stockRepo = new InMemorySupplyStockRepository();
    stockRepo.clear();
    distRepo = new InMemoryDistributionRepository();
    distRepo.clear();
    actionRepo = new InMemoryProcessedActionRepository();
    actionRepo.clear();
    clock = new FakeClock();
    idGen = new SequentialIdGenerator();

    const txRunner = new InMemoryTransactionRunner([stockRepo as any, distRepo as any]);
    const actionStore = new ProcessedActionStore(actionRepo, clock);
    const executor = new IdempotentCommandExecutor(actionStore);

    service = new DistributionService(
      stockRepo,
      distRepo,
      txRunner,
      executor,
      clock,
      idGen
    );
  });

  it("should distribute supplies to shelter and decrement stock on hand atomically", async () => {
    const stock = new SupplyStock({
      id: "stock-water-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Drinking Water (Liters)",
      onHand: 1000,
      version: 1,
    });
    await stockRepo.save(stock);

    const distribution = await service.distribute({
      actor: colomboOfficer,
      actionId: "action-dist-1",
      stockId: stock.id,
      destinationShelterId: "shelter-central-1",
      quantity: 250,
    });

    expect(distribution.id).toBeDefined();
    expect(distribution.quantity).toBe(250);
    expect(distribution.destinationShelterId).toBe("shelter-central-1");

    const refreshedStock = await stockRepo.findById(stock.id);
    expect(refreshedStock?.onHand).toBe(750);

    const distributions = await distRepo.findByFilter({ districtId: colomboDistrictId });
    expect(distributions).toHaveLength(1);
    expect(distributions[0].quantity).toBe(250);
  });

  it("should throw InsufficientStockError when requested quantity exceeds available stock", async () => {
    const stock = new SupplyStock({
      id: "stock-food-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Food Rations (Packs)",
      onHand: 50,
      version: 1,
    });
    await stockRepo.save(stock);

    await expect(
      service.distribute({
        actor: colomboOfficer,
        actionId: "action-dist-over",
        stockId: stock.id,
        destinationShelterId: "shelter-1",
        quantity: 100,
      })
    ).rejects.toThrow(InsufficientStockError);

    // Stock level must remain unchanged
    const unchanged = await stockRepo.findById(stock.id);
    expect(unchanged?.onHand).toBe(50);
  });

  it("should throw InvalidQuantityError when distributing zero or negative amounts", async () => {
    const stock = new SupplyStock({
      id: "stock-med-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Medical Kits",
      onHand: 100,
      version: 1,
    });
    await stockRepo.save(stock);

    await expect(
      service.distribute({
        actor: colomboOfficer,
        actionId: "action-zero",
        stockId: stock.id,
        destinationShelterId: "shelter-1",
        quantity: 0,
      })
    ).rejects.toThrow(InvalidQuantityError);

    await expect(
      service.distribute({
        actor: colomboOfficer,
        actionId: "action-neg",
        stockId: stock.id,
        destinationShelterId: "shelter-1",
        quantity: -10,
      })
    ).rejects.toThrow(InvalidQuantityError);
  });

  it("should throw NotFoundError when stock ID is invalid", async () => {
    await expect(
      service.distribute({
        actor: colomboOfficer,
        actionId: "action-missing",
        stockId: "non-existent-stock",
        destinationShelterId: "shelter-1",
        quantity: 20,
      })
    ).rejects.toThrow(NotFoundError);
  });
});
