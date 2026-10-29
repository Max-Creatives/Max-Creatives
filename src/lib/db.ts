import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma: PrismaClient | undefined };
function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be configured.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}
export const db = globalDb.prisma ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
