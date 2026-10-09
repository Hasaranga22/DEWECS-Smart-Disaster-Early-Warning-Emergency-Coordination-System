import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaAlertRepository } from './adapters/prisma/PrismaAlertRepository';
import { createUc1Module, type Uc1Module } from './index';

const g = globalThis as unknown as { uc1Module?: Uc1Module };

export function getUc1Module(): Uc1Module {
  if (!g.uc1Module) {
    if (process.env.DATA_STORE === 'prisma' && process.env.DATABASE_URL) {
      try {
        const prisma = new PrismaClient({
          adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
        });
        const alertRepo = new PrismaAlertRepository(prisma);
        g.uc1Module = createUc1Module({ alertRepo });
      } catch {
        g.uc1Module = createUc1Module();
      }
    } else {
      g.uc1Module = createUc1Module();
    }
  }
  return g.uc1Module;
}

export function resetUc1ModuleForTesting(): void {
  delete g.uc1Module;
}
