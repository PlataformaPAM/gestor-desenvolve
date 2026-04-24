import { prisma } from "@/lib/prisma";
import {
  EMPRESA_DOCUMENTO_CHAVE,
  emptyEmpresaDocumentoConfig,
  normalizeEmpresaDocumentoConfig,
  type EmpresaDocumentoConfig,
} from "@/lib/documentos/empresa-config-schema";

export * from "@/lib/documentos/empresa-config-schema";

type ConfiguracaoSistemaDelegate = {
  findUnique?: (args: { where: { chave: string }; select: { valor: true } }) => Promise<{ valor: unknown } | null>;
  upsert?: (args: {
    where: { chave: string };
    create: { chave: string; valor: EmpresaDocumentoConfig };
    update: { valor: EmpresaDocumentoConfig };
  }) => Promise<unknown>;
};

type PrismaMaybeWithConfig = {
  configuracaoSistema?: ConfiguracaoSistemaDelegate;
};

export async function getEmpresaDocumentoConfig(): Promise<EmpresaDocumentoConfig> {
  const db = prisma as unknown as PrismaMaybeWithConfig;
  if (db.configuracaoSistema?.findUnique) {
    const row = await db.configuracaoSistema.findUnique({
      where: { chave: EMPRESA_DOCUMENTO_CHAVE },
      select: { valor: true },
    });
    return normalizeEmpresaDocumentoConfig(row?.valor ?? null);
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ valor: unknown }>>`
      SELECT "valor"
      FROM "ConfiguracaoSistema"
      WHERE "chave" = ${EMPRESA_DOCUMENTO_CHAVE}
      LIMIT 1
    `;
    return normalizeEmpresaDocumentoConfig(rows[0]?.valor ?? null);
  } catch {
    return emptyEmpresaDocumentoConfig();
  }
}

export async function saveEmpresaDocumentoConfig(config: EmpresaDocumentoConfig): Promise<void> {
  const db = prisma as unknown as PrismaMaybeWithConfig;
  if (db.configuracaoSistema?.upsert) {
    await db.configuracaoSistema.upsert({
      where: { chave: EMPRESA_DOCUMENTO_CHAVE },
      create: { chave: EMPRESA_DOCUMENTO_CHAVE, valor: config },
      update: { valor: config },
    });
    return;
  }

  const json = JSON.stringify(config);
  await prisma.$executeRaw`
    INSERT INTO "ConfiguracaoSistema" ("id", "chave", "valor", "createdAt", "updatedAt")
    VALUES ('cfg_empresa_documento', ${EMPRESA_DOCUMENTO_CHAVE}, ${json}::jsonb, NOW(), NOW())
    ON CONFLICT ("chave")
    DO UPDATE SET "valor" = EXCLUDED."valor", "updatedAt" = NOW()
  `;
}
