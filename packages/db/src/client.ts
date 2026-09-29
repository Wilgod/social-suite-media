import { PrismaClient } from "./generated/prisma/client";
import { OAuthProvider, Platform } from "./generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const schemaFingerprint = `${Object.keys(Platform).join(",")}|${Object.keys(OAuthProvider).join(",")}`;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaSchema: string | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalThis.__prisma || globalThis.__prismaSchema !== schemaFingerprint) {
    globalThis.__prisma = createClient();
    globalThis.__prismaSchema = schemaFingerprint;
  }
  return globalThis.__prisma;
}

export const prisma = getClient();
