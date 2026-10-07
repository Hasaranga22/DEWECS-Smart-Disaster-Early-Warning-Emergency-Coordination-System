import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js development server clears Node's require cache during Fast Refresh.
// This causes a new PrismaClient instance to be created every time a file changes,
// which exhausts the database connection limit very quickly.
// The solution is to store the instance on the `globalThis` object, which is not cleared.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
