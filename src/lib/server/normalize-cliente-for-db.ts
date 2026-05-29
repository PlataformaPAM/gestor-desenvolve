import type { PrismaClient } from "@prisma/client";
import {
  normalizeClienteTextFields,
  normalizeClienteWithOfficialCity,
} from "@/lib/clientes/normalize-cliente";
import type { Cliente, Contato } from "@/lib/clientes/types";
import { resolveMunicipioNomeOficial } from "@/lib/server/resolve-municipio-nome-oficial";

type ClienteInput = Omit<Cliente, "id"> & { id?: string; contatos?: Contato[] };

export async function normalizeClienteForPersistence(
  db: Pick<PrismaClient, "extratorMunicipio">,
  cliente: ClienteInput
): Promise<ClienteInput> {
  const base = normalizeClienteTextFields(cliente);
  const cidade = base.endereco?.cidade?.trim();
  if (!cidade) return base;

  const official = await resolveMunicipioNomeOficial(db, cidade, base.endereco?.uf);
  return normalizeClienteWithOfficialCity(base, official);
}
