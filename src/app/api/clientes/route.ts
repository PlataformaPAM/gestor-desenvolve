import type { Cliente, Contato } from "@/lib/clientes/types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { mapClienteFromDb, toDateOrUndefined } from "../comercial/_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { clientesAccessGate } from "@/lib/server/clientes-access";
import { normalizeClienteForPersistence } from "@/lib/server/normalize-cliente-for-db";

type CreateClientePayload = Omit<Cliente, "id"> & { contatos?: Contato[] };

export async function POST(req: Request) {
  const gate = await clientesAccessGate(req, "criar");
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonSafe<{ cliente?: CreateClientePayload }>(req);
  if (!parsed.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const cliente = parsed.value.cliente;
  if (!cliente) {
    return fail("BAD_REQUEST", "Cliente inválido.", 400);
  }

  try {
    const normalized = await normalizeClienteForPersistence(prisma, cliente);
    const created = await prisma.cliente.create({
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
        endereco: normalized.endereco
          ? {
              create: {
                logradouro: normalized.endereco.logradouro,
                numero: normalized.endereco.numero,
                complemento: normalized.endereco.complemento ?? null,
                bairro: normalized.endereco.bairro,
                cidade: normalized.endereco.cidade,
                uf: normalized.endereco.uf,
                cep: normalized.endereco.cep,
              },
            }
          : undefined,
        contatos: {
          create: (normalized.contatos ?? []).map((c) => ({
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
      },
    });
    await writeAuditLog(prisma, {
      acao: "Cliente criado",
      modulo: "clientes",
      detalhes: `Cliente ${created.nome} (${created.id})`,
    });

    return ok(
      {
        cliente: mapClienteFromDb({
          ...created,
          propostas: [],
          faturas: [],
          ticketsResumo: [],
        }),
      },
      201
    );
  } catch (error) {
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
}

