import type { ColaboradorParceiro } from "@/lib/rh/types";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapColaborador } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import {
  failCadastroEfetivadoMigrationPending,
  isCadastroEfetivadoMissingInDatabase,
} from "@/lib/server/rh-colaborador-db-errors";
import { writeAuditLog } from "@/lib/server/audit-log";
import { rhColaboradoresAccessGate } from "@/lib/server/rh-access";
import { RH_CONSULTOR_PRE_CADASTRO_CARGO } from "@/lib/rh/pre-cadastro-consultor";

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

function isPreConsultorRow(existing: {
  tipoPessoa: string;
  cargoOuFuncao: string;
  cadastroEfetivado?: boolean;
}): boolean {
  if (existing.tipoPessoa !== "vendedor_externo") return false;
  const raw = (existing as { cadastroEfetivado?: boolean }).cadastroEfetivado;
  if (raw === false) return true;
  if (raw === true) return false;
  return existing.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO;
}

function validateConsultorAoEfetivar(c: ColaboradorParceiro): string | null {
  if (!c.nome?.trim()) return "Nome é obrigatório para efetivar o cadastro.";
  const cargo = (c.cargoOuFuncao ?? "").trim();
  if (!cargo || cargo === RH_CONSULTOR_PRE_CADASTRO_CARGO) {
    return "Informe cargo/função para efetivar o cadastro.";
  }
  const doc = digitsOnly(c.cpfCnpj);
  if (!doc) return "Informe CPF ou CNPJ para efetivar o cadastro.";
  if (doc.length === 14) {
    const contatos = c.contatos ?? [];
    const temContato = contatos.some(
      (ct) => (ct.nome?.trim() || ct.email?.trim() || ct.telefone?.trim()) ?? false
    );
    if (!temContato) return "Pessoa jurídica (CNPJ): inclua pelo menos um contato para efetivar.";
  }
  return null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await rhColaboradoresAccessGate(req, "editar", id);
  if (!gate.ok) return gate.response;
  const body = await parseJsonSafe<{ colaborador?: ColaboradorParceiro }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const c = body.value.colaborador;
  if (!c || c.id !== id) return fail("BAD_REQUEST", "Payload inválido.", 400);

  const existing = await prisma.colaboradorRH.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Colaborador não encontrado.", 404);

  const wasPreConsultor = isPreConsultorRow(existing);
  const existingEfetivado = !wasPreConsultor;

  if (existingEfetivado && c.cadastroEfetivado === false) {
    return fail("BAD_REQUEST", "Não é permitido reverter um cadastro já efetivado para pré-cadastro.", 400);
  }

  const nextEfetivado = c.cadastroEfetivado !== undefined ? c.cadastroEfetivado !== false : existingEfetivado;
  const becomingEfetivado = wasPreConsultor && nextEfetivado === true;

  if (becomingEfetivado) {
    const err = validateConsultorAoEfetivar(c);
    if (err) return fail("BAD_REQUEST", err, 400);
  }

  const doc = digitsOnly(c.cpfCnpj);
  const b2bCnpjComContatosNoPatch =
    (c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") &&
    doc.length === 14 &&
    c.contatos !== undefined;
  if (b2bCnpjComContatosNoPatch && nextEfetivado) {
    const temContato = (c.contatos ?? []).some(
      (ct) => (ct.nome?.trim() || ct.email?.trim() || ct.telefone?.trim()) ?? false
    );
    if (!temContato) {
      return fail("BAD_REQUEST", "Pessoa jurídica (CNPJ): informe pelo menos um contato.", 400);
    }
  }

  try {
    const runUpdate = async (persistirContatos: boolean, incluirCadastroEfetivado: boolean) => {
      await prisma.$transaction(async (tx) => {
        await tx.colaboradorRH.update({
          where: { id },
          data: {
            nome: c.nome,
            cargoOuFuncao: c.cargoOuFuncao,
            tipoContrato: c.tipoContrato,
            status: c.status,
            tipoPessoa: c.tipo,
            ...(incluirCadastroEfetivado ? { cadastroEfetivado: nextEfetivado } : {}),
            email: c.email ?? null,
            telefone: c.telefone ?? null,
            cpfCnpj: c.cpfCnpj ?? null,
            totalVendasMes: c.totalVendasMes ?? null,
            ultimoAcesso: c.ultimoAcesso ? new Date(c.ultimoAcesso) : null,
            ...(persistirContatos && c.contatos !== undefined
              ? {
                  contatosFornecedor:
                    (c.tipo === "fornecedor_parceiro" || c.tipo === "vendedor_externo") &&
                    c.contatos.length
                      ? (c.contatos as unknown as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                }
              : {}),
          },
        });
        if (c.dadosBancarios) {
          await tx.colaboradorDadosBancarios.upsert({
            where: { colaboradorId: id },
            create: {
              colaboradorId: id,
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
            update: {
              banco: c.dadosBancarios.banco ?? null,
              agencia: c.dadosBancarios.agencia ?? null,
              conta: c.dadosBancarios.conta ?? null,
              tipoConta: c.dadosBancarios.tipoConta ?? null,
              pix: c.dadosBancarios.pix ?? null,
            },
          });
        }
        await tx.colaboradorDocumento.deleteMany({ where: { colaboradorId: id } });
        if (c.documentos?.length) {
          await tx.colaboradorDocumento.createMany({
            data: c.documentos.map((d) => ({ colaboradorId: id, nome: d.nome, url: d.url ?? null })),
          });
        }
      });
    };

    try {
      await runUpdate(true, true);
    } catch (error) {
      if (c.contatos !== undefined && isContatosFornecedorColumnError(error)) {
        try {
          await runUpdate(false, true);
        } catch (e2) {
          if (isCadastroEfetivadoMissingInDatabase(e2)) {
            try {
              await runUpdate(false, false);
            } catch (e3) {
              throw e3;
            }
          } else {
            throw e2;
          }
        }
      } else if (isCadastroEfetivadoMissingInDatabase(error)) {
        try {
          await runUpdate(true, false);
        } catch (e2) {
          if (c.contatos !== undefined && isContatosFornecedorColumnError(e2)) {
            await runUpdate(false, false);
          } else {
            throw e2;
          }
        }
      } else {
        throw error;
      }
    }

    const updated = await prisma.colaboradorRH.findUniqueOrThrow({
      where: { id },
      include: { dadosBancarios: true, documentos: true },
    });

    await writeAuditLog(prisma, {
      acao: "Colaborador atualizado",
      modulo: "rh",
      detalhes: `Colaborador ${updated.nome} (${updated.id})`,
    });
    return ok({ colaborador: mapColaborador(updated) });
  } catch (error) {
    if (isCadastroEfetivadoMissingInDatabase(error)) {
      return failCadastroEfetivadoMigrationPending();
    }
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
