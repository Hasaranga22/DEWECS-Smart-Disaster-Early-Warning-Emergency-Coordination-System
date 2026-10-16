import { ProcessedAction, ProcessedActionProps } from "../../domain/entities/ProcessedAction";
import { ProcessedActionRepository } from "../repositories/ProcessedActionRepository";

interface KeyedAction extends ProcessedActionProps {
  id: string;
}

export class InMemoryProcessedActionRepository implements ProcessedActionRepository {
  private readonly actions = new Map<string, ProcessedActionProps>();

  public async findByActionId(actionId: string): Promise<ProcessedAction | null> {
    const props = this.actions.get(actionId);
    return props ? new ProcessedAction(props) : null;
  }

  public async save(action: ProcessedAction): Promise<void> {
    this.actions.set(action.actionId, {
      actionId: action.actionId,
      type: action.type,
      resultRef: action.resultRef,
      processedAt: action.processedAt,
    });
  }

  public clear(): void {
    this.actions.clear();
  }

  public snapshot(): Map<string, ProcessedActionProps> {
    const snap = new Map<string, ProcessedActionProps>();
    for (const [key, value] of this.actions.entries()) {
      snap.set(key, { ...value });
    }
    return snap;
  }

  public restore(snap: Map<string, ProcessedActionProps>): void {
    this.actions.clear();
    for (const [key, value] of snap.entries()) {
      this.actions.set(key, { ...value });
    }
  }
}
