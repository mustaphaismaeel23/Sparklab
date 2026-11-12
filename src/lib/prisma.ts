import { PrismaClient } from '@prisma/client';
import { configurePrismaUrl } from '@/lib/prisma-url';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return new PrismaClient();

  return new PrismaClient({ datasources: { db: { url: configurePrismaUrl(connectionString) } } });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
