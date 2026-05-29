import type { PrismaClient } from "@prisma/client";
import { mapClienteFromDb } from "@/app/api/comercial/_shared";
import type { Cliente, ClienteEndereco, Contato } from "@/lib/clientes/types";
import { normalizeClienteForPersistence } from "@/lib/server/normalize-cliente-for-db";

function enderecoChanged(before: ClienteEndereco | undefined, after: ClienteEndereco | undefined): boolean {
  if (!before && !after) return false;
  if (!before || !after) return true;
  return (
    before.logradouro !== after.logradouro ||
    before.numero !== after.numero ||
    (before.complemento ?? "") !== (after.complemento ?? "") ||
    before.bairro !== after.bairro ||
    before.cidade !== after.cidade ||
    before.uf !== after.uf ||
    before.cep !== after.cep
  );
}

function contatosChanged(before: Contato[], after: Contato[]): boolean {
  if (before.length !== after.length) return true;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i];
    const b = after[i];
    if (
      a.id !== b.id ||
      a.nome !== b.nome ||
      a.email !== b.email ||
      a.telefone !== b.telefone ||
      (a.setor ?? "") !== (b.setor ?? "") ||
      (a.cargo ?? "") !== (b.cargo ?? "")
    ) {
      return true;
    }
  }
  return false;
}

export function clientePayloadChanged(before: Cliente, after: Cliente): boolean {
  return (
    before.nome !== after.nome ||
    before.empresa !== after.empresa ||
    (before.email ?? "") !== (after.email ?? "") ||
    (before.telefone ?? "") !== (after.telefone ?? "") ||
    enderecoChanged(before.endereco, after.endereco) ||
    contatosChanged(before.contatos ?? [], after.contatos ?? [])
  );
}

export type NormalizeClientesBackfillResult = {
  total: number;
  updated: number;
  skipped: number;
};

export async function runNormalizeClientesBackfill(
  db: PrismaClient
): Promise<NormalizeClientesBackfillResult> {
  const rows = await db.cliente.findMany({
    include: {
      endereco: true,
      contatos: { include: { papeis: true } },
      propostas: true,
      faturas: true,
      ticketsResumo: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const mapped = mapClienteFromDb({
      ...row,
      criadoPor: null,
    });
    const normalized = await normalizeClienteForPersistence(db, mapped);
    if (!clientePayloadChanged(mapped, normalized as Cliente)) {
      skipped += 1;
      continue;
    }

    await db.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id: row.id },
        data: {
          nome: normalized.nome,
          empresa: normalized.empresa,
          email: normalized.email ?? null,
          telefone: normalized.telefone ?? null,
        },
      });

      if (normalized.endereco) {
        await tx.clienteEndereco.upsert({
          where: { clienteId: row.id },
          create: {
            clienteId: row.id,
            logradouro: normalized.endereco.logradouro,
            numero: normalized.endereco.numero,
            complemento: normalized.endereco.complemento ?? null,
            bairro: normalized.endereco.bairro,
            cidade: normalized.endereco.cidade,
            uf: normalized.endereco.uf,
            cep: normalized.endereco.cep,
          },
          update: {
            logradouro: normalized.endereco.logradouro,
            numero: normalized.endereco.numero,
            complemento: normalized.endereco.complemento ?? null,
            bairro: normalized.endereco.bairro,
            cidade: normalized.endereco.cidade,
            uf: normalized.endereco.uf,
            cep: normalized.endereco.cep,
          },
        });
      }

      await tx.clienteContatoPapel.deleteMany({
        where: { clienteContato: { clienteId: row.id } },
      });
      await tx.clienteContato.deleteMany({ where: { clienteId: row.id } });

      for (const c of normalized.contatos ?? []) {
        await tx.clienteContato.create({
          data: {
            id: c.id,
            clienteId: row.id,
            nome: c.nome,
            email: c.email,
            telefone: c.telefone,
            setor: c.setor ?? null,
            cargo: c.cargo ?? null,
            papeis: { create: (c.papeis ?? []).map((p) => ({ papel: p })) },
          },
        });
      }
    });

    updated += 1;
  }

  return { total: rows.length, updated, skipped };
}
