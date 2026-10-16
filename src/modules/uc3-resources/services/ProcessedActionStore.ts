import { ProcessedAction } from "../domain/entities/ProcessedAction";
import { ProcessedActionRepository } from "../adapters/repositories/ProcessedActionRepository";
import { Clock } from "@/shared/contracts/Clock";

export class ProcessedActionStore {
  constructor(
    private readonly repo: ProcessedActionRepository,
    private readonly clock: Clock
  ) {}

  public async findProcessed(actionId: string): Promise<ProcessedAction | null> {
    return this.repo.findByActionId(actionId);
  }

  public async recordAction(actionId: string, type: string, resultRef?: string): Promise<void> {
    const action = new ProcessedAction({
      actionId,
      type,
      resultRef,
      processedAt: this.clock.now(),
    });
    await this.repo.save(action);
  }
}
