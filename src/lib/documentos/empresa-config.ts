import { prisma } from "@/lib/prisma";

export const EMPRESA_DOCUMENTO_CHAVE = "empresa_documento";

export type EmpresaDocumentoConfig = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  logoUrl: string;
  cabecalhoPadraoHtml: string;
  rodapePadraoHtml: string;
};

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

export function emptyEmpresaDocumentoConfig(): EmpresaDocumentoConfig {
  return {
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    logoUrl: "",
    cabecalhoPadraoHtml: "",
    rodapePadraoHtml: "",
  };
}

export function normalizeEmpresaDocumentoConfig(raw: unknown): EmpresaDocumentoConfig {
  const base = emptyEmpresaDocumentoConfig();
  if (!raw) return base;

  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return base;
    }
  }

  if (typeof source !== "object") return base;
  const o = source as Record<string, unknown>;
  return {
    razaoSocial: String(o.razaoSocial ?? "").trim(),
    nomeFantasia: String(o.nomeFantasia ?? "").trim(),
    cnpj: String(o.cnpj ?? "").trim(),
    telefone: String(o.telefone ?? "").trim(),
    email: String(o.email ?? "").trim(),
    site: String(o.site ?? "").trim(),
    endereco: String(o.endereco ?? "").trim(),
    logoUrl: String(o.logoUrl ?? "").trim(),
    cabecalhoPadraoHtml: String(o.cabecalhoPadraoHtml ?? ""),
    rodapePadraoHtml: String(o.rodapePadraoHtml ?? ""),
  };
}

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
