import { Actor } from "@/shared/contracts/types";
import { ProcessedActionStore } from "./ProcessedActionStore";
import { ResourceAccessPolicy } from "./ResourceAccessPolicy";

export interface IdempotentCommand<T> {
  actionId: string;
  actionType: string;
  actor: Actor;
  districtId: string;
  execute: () => Promise<{ result: T; resultRef?: string }>;
  onReplay?: (storedRef?: string) => Promise<T>;
}

export class IdempotentCommandExecutor {
  constructor(private readonly actionStore: ProcessedActionStore) {}

  public async executeCommand<T>(command: IdempotentCommand<T>): Promise<T> {
    // 1. Role & District Access Boundary Check
    ResourceAccessPolicy.assertDistrictOfficerAccess(command.actor, command.districtId);

    // 2. Idempotency Replay Check
    const existing = await this.actionStore.findProcessed(command.actionId);
    if (existing) {
      if (command.onReplay) {
        return command.onReplay(existing.resultRef);
      }
    }

    // 3. Execute Core Service Command
    const { result, resultRef } = await command.execute();

    // 4. Record Action for Future Idempotent Replays
    await this.actionStore.recordAction(command.actionId, command.actionType, resultRef);

    return result;
  }
}
