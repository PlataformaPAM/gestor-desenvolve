import type { PrismaClient } from "@prisma/client";
import { accentKey } from "@/lib/text/portuguese-text";

const cacheByUf = new Map<string, Map<string, string>>();

/**
 * Resolve nome oficial do município (com acentos) via malha IBGE do Extrator.
 * Retorna null se não houver cadastro sincronizado ou não encontrar correspondência.
 */
export async function resolveMunicipioNomeOficial(
  db: Pick<PrismaClient, "extratorMunicipio">,
  cidade: string,
  uf?: string | null
): Promise<string | null> {
  const cityKey = accentKey(cidade);
  if (!cityKey || cityKey.length < 2) return null;

  const ufSigla = uf?.trim().toUpperCase().slice(0, 2) || "";
  const cacheKey = ufSigla || "__all__";

  let map = cacheByUf.get(cacheKey);
  if (!map) {
    try {
      const rows = await db.extratorMunicipio.findMany({
        where: ufSigla ? { uf: { sigla: ufSigla } } : undefined,
        select: { nome: true },
      });
      map = new Map<string, string>();
      for (const row of rows) {
        map.set(accentKey(row.nome), row.nome);
      }
      cacheByUf.set(cacheKey, map);
    } catch {
      return null;
    }
  }

  return map.get(cityKey) ?? null;
}
