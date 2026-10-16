import { prisma } from "@/shared/infra/prisma/client";
import { ProcessedAction } from "../../domain/entities/ProcessedAction";
import { ProcessedActionRepository } from "../repositories/ProcessedActionRepository";

export class PrismaProcessedActionRepository implements ProcessedActionRepository {
  public async findByActionId(actionId: string): Promise<ProcessedAction | null> {
    const raw = await prisma.processedAction.findUnique({ where: { actionId } });
    if (!raw) return null;
    return new ProcessedAction({
      actionId: raw.actionId,
      type: raw.type,
      resultRef: raw.resultRef ?? undefined,
      processedAt: raw.processedAt,
    });
  }

  public async save(action: ProcessedAction): Promise<void> {
    try {
      await prisma.processedAction.create({
        data: {
          actionId: action.actionId,
          type: action.type,
          resultRef: action.resultRef,
          processedAt: action.processedAt,
        },
      });
    } catch (error: any) {
      // Catch Prisma P2002 unique constraint violation on actionId
      if (error?.code === "P2002") {
        return;
      }
      throw error;
    }
  }
}
