import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Ancora resolução no app (`next` existe em todo projeto Next; mais estável que `package.json` para o `createRequire`). */
const nodeRequire = createRequire(path.join(process.cwd(), "node_modules", "next", "package.json"));

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

/** Libera o cache do `require` do client gerado para o próximo `makePrisma` enxergar modelos novos após `prisma generate`. */
function clearPrismaClientRequireCache(): void {
  for (const key of Object.keys(nodeRequire.cache)) {
    const unified = path.normalize(key).replace(/\\/g, "/");
    if (unified.includes("/node_modules/.prisma/client") || unified.includes("/node_modules/@prisma/client")) {
      delete nodeRequire.cache[key];
    }
  }
}

function makePrisma(): PrismaClient {
  if (process.env.NODE_ENV === "development") {
    clearPrismaClientRequireCache();
  }
  const { PrismaClient: PrismaClientCtor } = nodeRequire("@prisma/client") as typeof import("@prisma/client");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClientCtor({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

/** Em dev, detecta singleton criado com `require` antigo (antes de novo `prisma generate`), sem mudar mtime ainda. */
function devPrismaClientIsMissingDocumentoModeloDelegate(client: PrismaClient): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    Reflect.get(client, "documentoModelo") === undefined
  );
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
  } else if (devPrismaClientIsMissingDocumentoModeloDelegate(globalThis.__prisma)) {
    void globalThis.__prisma.$disconnect().catch(() => {});
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
