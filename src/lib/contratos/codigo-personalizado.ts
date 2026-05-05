import { prisma } from "@/lib/prisma";

const CONTRATO_CODIGO_CUSTOM_CHAVE = "contrato_codigo_personalizado";

type CodigoCustomMap = Record<string, string>;

function normalizeMap(raw: unknown): CodigoCustomMap {
  if (!raw || typeof raw !== "object") return {};
  const out: CodigoCustomMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(k ?? "").trim();
    const value = String(v ?? "").trim();
    if (id && value) out[id] = value;
  }
  return out;
}

function sanitizeCodigoPersonalizado(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^_+/, "")
    .replace(/_+/g, "-");
}

export function composeCodigoContrato(codigoSistema: string, codigoPersonalizado?: string | null): string {
  const custom = sanitizeCodigoPersonalizado(codigoPersonalizado ?? "");
  if (!custom) return codigoSistema;
  return `${codigoSistema}_${custom}`;
}

export async function getContratoCodigoPersonalizadoMap(): Promise<CodigoCustomMap> {
  try {
    const row = await prisma.configuracaoSistema.findUnique({
      where: { chave: CONTRATO_CODIGO_CUSTOM_CHAVE },
      select: { valor: true },
    });
    return normalizeMap(row?.valor);
  } catch {
    return {};
  }
}

export async function setContratoCodigoPersonalizado(contratoId: string, codigoPersonalizado?: string | null): Promise<void> {
  const id = String(contratoId ?? "").trim();
  if (!id) return;
  const nextValue = sanitizeCodigoPersonalizado(codigoPersonalizado ?? "");
  const current = await getContratoCodigoPersonalizadoMap();
  if (nextValue) current[id] = nextValue;
  else delete current[id];
  await prisma.configuracaoSistema.upsert({
    where: { chave: CONTRATO_CODIGO_CUSTOM_CHAVE },
    create: { chave: CONTRATO_CODIGO_CUSTOM_CHAVE, valor: current },
    update: { valor: current },
  });
}
