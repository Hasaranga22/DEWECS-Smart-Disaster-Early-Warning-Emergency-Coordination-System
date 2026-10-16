import { ProcessedAction } from "../../domain/entities/ProcessedAction";

export interface ProcessedActionRepository {
  findByActionId(actionId: string): Promise<ProcessedAction | null>;
  save(action: ProcessedAction): Promise<void>;
}
