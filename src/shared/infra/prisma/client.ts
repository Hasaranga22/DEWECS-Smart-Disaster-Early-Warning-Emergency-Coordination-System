/**
 * Shared Prisma client access point (README §4: `infra/prisma/client.ts`).
 *
 * Re-exports the globalThis-backed singleton from `../prisma`, so there is
 * exactly one PrismaClient instance no matter which import path is used.
 * Adapters import prisma from HERE — never from `@/generated/...` directly.
 */
export { prisma } from '@/shared/infra/prisma'
