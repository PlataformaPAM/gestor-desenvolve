import type { ColaboradorParceiro } from "@/lib/rh/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";

function digitsOnly(v: string | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function isContatosFornecedorColumnError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "");
  if (msg.includes("Unknown argument `contatosFornecedor`")) return true;
  if (msg.includes("Unknown field `contatosFornecedor`")) return true;
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021" && error.code !== "P2022") return false;
  return msg.includes("contatosFornecedor");
}

function isTipoContratoEnumError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("tipocontrato") &&
    (msg.includes("invalid input value for enum") || msg.includes("provided value"))
  );
}

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ colaborador?: ColaboradorParceiro }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const c = body.value.colaborador;
  if (!c?.nome?.trim() || !c?.cargoOuFuncao?.trim()) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const doc = digitsOnly(c.cpfCnpj);
  const b2bComContatosCnpj =
    (c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") && doc.length === 14;
  if (b2bComContatosCnpj) {
    const contatos = c.contatos ?? [];
    const temContato = contatos.some(
      (ct) => (ct.nome?.trim() || ct.email?.trim() || ct.telefone?.trim()) ?? false
    );
    if (!temContato) {
      return fail("BAD_REQUEST", "Pessoa jurídica (CNPJ): informe pelo menos um contato.", 400);
    }
  }

  try {
    const baseData = {
      id: c.id || undefined,
      nome: c.nome.trim(),
      cargoOuFuncao: c.cargoOuFuncao.trim(),
      tipoContrato: c.tipoContrato,
      status: c.status,
      tipoPessoa: c.tipo,
      email: c.email ?? null,
      telefone: c.telefone ?? null,
      cpfCnpj: c.cpfCnpj ?? null,
      totalVendasMes: c.totalVendasMes ?? null,
      ultimoAcesso: c.ultimoAcesso ? new Date(c.ultimoAcesso) : null,
      dadosBancarios: c.dadosBancarios
        ? {
            create: {
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
          }
        : undefined,
      documentos: c.documentos?.length
        ? {
            create: c.documentos.map((d) => ({ nome: d.nome, url: d.url ?? null })),
          }
        : undefined,
    };

    const include = { dadosBancarios: true, documentos: true };
    const dataComContatos = {
      ...baseData,
      ...(c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo"
        ? {
            contatosFornecedor: c.contatos?.length
              ? (c.contatos as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
    };

    let created;
    try {
      created = await prisma.colaboradorRH.create({ data: dataComContatos, include });
    } catch (error) {
      if (
        !((c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") &&
          isContatosFornecedorColumnError(error))
      )
        throw error;
      created = await prisma.colaboradorRH.create({ data: baseData, include });
    }

    await writeAuditLog(prisma, {
      acao: "Colaborador criado",
      modulo: "rh",
      detalhes: `Colaborador ${created.nome} (${created.id})`,
    });
    return ok({ colaborador: mapColaborador(created) }, 201);
  } catch (error) {
    if (isTipoContratoEnumError(error)) {
      return fail(
        "BAD_REQUEST",
        "Tipo de contrato indisponível no banco atual. Atualize as migrations e tente novamente.",
        400
      );
    }
    return fail("INTERNAL_ERROR", "Não foi possível salvar a pessoa. Tente novamente.", 500);
  }
}

