import type { Cliente } from "@/lib/clientes/types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { mapClienteFromDb, toDateOrUndefined } from "@/app/api/comercial/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { clientesAccessGate } from "@/lib/server/clientes-access";
import { normalizeClienteForPersistence } from "@/lib/server/normalize-cliente-for-db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await clientesAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;
  const parsed = await parseJsonSafe<{ cliente?: Cliente }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const cliente = parsed.value.cliente;
  if (!cliente || cliente.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  try {
    const normalized = await normalizeClienteForPersistence(prisma, cliente);
    await prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id },
        data: {
          nome: normalized.nome,
          empresa: normalized.empresa,
          cpfCnpj: normalized.cpfCnpj,
          status: normalized.status,
          valorMensal: normalized.valorMensal,
          segmento: normalized.segmento,
          email: normalized.email ?? null,
          telefone: normalized.telefone ?? null,
          urlSiteOficial: normalized.urlSiteOficial ?? null,
          dataFechamento: toDateOrUndefined(normalized.dataFechamento),
        },
      });

      if (normalized.endereco) {
        await tx.clienteEndereco.upsert({
          where: { clienteId: id },
          create: {
            clienteId: id,
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
      } else {
        await tx.clienteEndereco.deleteMany({ where: { clienteId: id } });
      }

      await tx.clienteContatoPapel.deleteMany({ where: { clienteContato: { clienteId: id } } });
      await tx.clienteContato.deleteMany({ where: { clienteId: id } });
      for (const c of normalized.contatos ?? []) {
        await tx.clienteContato.create({
          data: {
            id: c.id,
            clienteId: id,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail("NOT_FOUND", "Cliente não encontrado.", 404);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("BAD_REQUEST", "Já existe cliente com este CPF/CNPJ.", 400);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return fail(
        "INTERNAL_ERROR",
        "Banco de dados em produção está desatualizado para o cadastro de clientes. Aplique as migrações pendentes.",
        500
      );
    }
    return fail("INTERNAL_ERROR", "Não foi possível salvar o cliente.", 500);
  }

  const saved = await prisma.cliente.findUniqueOrThrow({
    where: { id },
    include: {
      endereco: true,
      contatos: { include: { papeis: true } },
      propostas: true,
      faturas: true,
      ticketsResumo: true,
    },
  });
  await writeAuditLog(prisma, {
    acao: "Cliente atualizado",
    modulo: "clientes",
    detalhes: `Cliente ${saved.nome} (${saved.id})`,
  });
  return ok({ cliente: mapClienteFromDb(saved) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await clientesAccessGate(req, "excluir", id);
  if (!gate.ok) return gate.response;
  const existing = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nome: true } });
  if (!existing) return fail("NOT_FOUND", "Cliente não encontrado.", 404);
  try {
    await prisma.cliente.delete({ where: { id } });
  } catch {
    return fail("INTERNAL_ERROR", "Não foi possível excluir o cliente.", 500);
  }
  await writeAuditLog(prisma, {
    acao: "Cliente excluído",
    modulo: "clientes",
    detalhes: `Cliente ${existing.nome} (${existing.id})`,
  });
  return ok({ deleted: true });
}

