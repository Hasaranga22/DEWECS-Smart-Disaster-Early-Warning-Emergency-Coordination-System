import { Actor } from "@/shared/contracts/types";
import { Distribution } from "../domain/entities/Distribution";
import { SupplyStockRepository } from "../adapters/repositories/SupplyStockRepository";
import { DistributionRepository } from "../adapters/repositories/DistributionRepository";
import { TransactionRunner } from "@/shared/infra/TransactionRunner";
import { IdempotentCommandExecutor } from "./IdempotentCommandExecutor";
import { Clock } from "@/shared/contracts/Clock";
import { IdGenerator } from "@/shared/contracts/IdGenerator";
import { NotFoundError } from "@/shared/infra/errors";

export interface DistributeSupplyCommand {
  actionId: string;
  actor: Actor;
  stockId: string;
  destinationShelterId: string;
  quantity: number;
}

export class DistributionService {
  constructor(
    private readonly stockRepo: SupplyStockRepository,
    private readonly distributionRepo: DistributionRepository,
    private readonly txRunner: TransactionRunner,
    private readonly executor: IdempotentCommandExecutor,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator
  ) {}

  public async distribute(command: DistributeSupplyCommand): Promise<Distribution> {
    const stock = await this.stockRepo.findById(command.stockId);
    if (!stock) {
      throw new NotFoundError(`Supply stock '${command.stockId}' not found`);
    }

    return this.executor.executeCommand({
      actionId: command.actionId,
      actionType: "DISTRIBUTE_SUPPLY",
      actor: command.actor,
      districtId: stock.districtId,
      execute: async () => {
        // Execute stock decrement and distribution record atomically inside TransactionRunner
        return this.txRunner.runInTransaction(async () => {
          // Deduct from stock (throws InsufficientStockError if onHand < quantity)
          const updatedStock = stock.withDeduction(command.quantity);

          const record = new Distribution({
            id: this.idGen.next(),
            stockId: stock.id,
            destinationShelterId: command.destinationShelterId,
            organizationId: stock.organizationId,
            districtId: stock.districtId,
            quantity: command.quantity,
            actorId: command.actor.id,
            occurredAt: this.clock.now(),
            actionId: command.actionId,
          });

          await this.stockRepo.save(updatedStock);
          await this.distributionRepo.save(record);

          return { result: record, resultRef: record.id };
        });
      },
      onReplay: async (resultRef) => {
        if (resultRef) {
          const existing = await this.distributionRepo.findById(resultRef);
          if (existing) return existing;
        }
        throw new NotFoundError(`Distribution record for action '${command.actionId}' not found`);
      },
    });
  }
}
