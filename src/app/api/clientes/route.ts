import type { Cliente, Contato } from "@/lib/clientes/types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { mapClienteFromDb, toDateOrUndefined } from "../comercial/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

type CreateClientePayload = Omit<Cliente, "id"> & { contatos?: Contato[] };

export async function POST(req: Request) {
  const parsed = await parseJsonSafe<{ cliente?: CreateClientePayload }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const cliente = parsed.value.cliente;
  if (!cliente) {
    return fail("BAD_REQUEST", "Cliente inválido.", 400);
  }

  try {
    const created = await prisma.cliente.create({
      data: {
        nome: cliente.nome,
        empresa: cliente.empresa,
        cpfCnpj: cliente.cpfCnpj,
        status: cliente.status,
        valorMensal: cliente.valorMensal,
        segmento: cliente.segmento,
        email: cliente.email ?? null,
        telefone: cliente.telefone ?? null,
        urlSiteOficial: cliente.urlSiteOficial ?? null,
        dataFechamento: toDateOrUndefined(cliente.dataFechamento),
        endereco: cliente.endereco
          ? {
              create: {
                logradouro: cliente.endereco.logradouro,
                numero: cliente.endereco.numero,
                complemento: cliente.endereco.complemento ?? null,
                bairro: cliente.endereco.bairro,
                cidade: cliente.endereco.cidade,
                uf: cliente.endereco.uf,
                cep: cliente.endereco.cep,
              },
            }
          : undefined,
        contatos: {
          create: (cliente.contatos ?? []).map((c) => ({
            nome: c.nome,
            email: c.email,
            telefone: c.telefone,
            setor: c.setor ?? null,
            cargo: c.cargo ?? null,
            papeis: { create: (c.papeis ?? []).map((p) => ({ papel: p })) },
          })),
        },
      },
      include: {
        endereco: true,
        contatos: { include: { papeis: true } },
        propostas: true,
        faturas: true,
        ticketsResumo: true,
      },
    });
    await writeAuditLog(prisma, {
      acao: "Cliente criado",
      modulo: "clientes",
      detalhes: `Cliente ${created.nome} (${created.id})`,
    });

    return ok({ cliente: mapClienteFromDb(created) }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("BAD_REQUEST", "Já existe cliente com este CPF/CNPJ.", 400);
    }
    return fail("INTERNAL_ERROR", "Não foi possível salvar o cliente.", 500);
  }
}

