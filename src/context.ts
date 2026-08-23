import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export interface GraphQLContext {
  prisma: PrismaClient;
}

export function createContext(customPrisma?: PrismaClient): GraphQLContext {
  return {
    prisma: customPrisma ?? defaultPrisma,
  };
}
