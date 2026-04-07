import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaClientGenMtime: number | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida.");
}

function generatedClientMtime(): number {
  const p = path.join(process.cwd(), "node_modules/.prisma/client/index.js");
  if (!existsSync(p)) return 0;
  return statSync(p).mtimeMs;
}

function makePrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

/** Em dev, reinstancia o cliente após `prisma generate` (o singleton global antigo ficava com DMMF desatualizado). */
function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return globalThis.__prisma ?? (globalThis.__prisma = makePrisma());
  }
  const currentMtime = generatedClientMtime();
  if (globalThis.__prismaClientGenMtime !== currentMtime) {
    void globalThis.__prisma?.$disconnect().catch(() => {});
    globalThis.__prisma = undefined;
    globalThis.__prismaClientGenMtime = currentMtime;
  }
  if (!globalThis.__prisma) {
    globalThis.__prisma = makePrisma();
  }
  return globalThis.__prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
