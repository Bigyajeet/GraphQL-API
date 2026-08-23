import { PrismaClient } from "@prisma/client";

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  "postgresql://vault:vault@localhost:5432/vault_test?schema=public";

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await testPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function resetTestDatabase(): Promise<void> {
  await testPrisma.document.deleteMany({});
  await testPrisma.collection.deleteMany({});
}
