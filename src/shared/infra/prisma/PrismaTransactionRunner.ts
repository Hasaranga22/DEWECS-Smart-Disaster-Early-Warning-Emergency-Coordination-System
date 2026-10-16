import { TransactionRunner } from "../TransactionRunner";
import { prisma } from "./client";

export class PrismaTransactionRunner implements TransactionRunner {
  public async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return prisma.$transaction(async () => {
      return work();
    });
  }
}
