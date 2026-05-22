import type { UsuarioSistema } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { mapUsuario } from "../../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CONFIG_RESOURCES, configuracoesAccessGate } from "@/lib/server/configuracoes-access";
import { hashPassword, validatePasswordPolicy } from "@/lib/server/password";

type UsuarioPatchBody = UsuarioSistema & { senha?: string };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await configuracoesAccessGate(req, CONFIG_RESOURCES.usuarios, "editar");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = await parseJsonSafe<{ usuario?: UsuarioPatchBody }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const u = body.value.usuario;
  if (!u || u.id !== id) {
    return fail("BAD_REQUEST", "Payload inválido.", 400);
  }

  const cpfUsuario = u.cpf.replace(/\D/g, "");
  const isCpf = (doc?: string | null) => (doc ?? "").replace(/\D/g, "").length === 11;
  const vinculos = (u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : []).filter(
    (v): v is { tipo: "rh" | "cliente"; id: string } => Boolean(v?.tipo && v?.id)
  );
  const novaSenhaRaw = typeof u.senha === "string" ? u.senha.trim() : "";
  const novaSenha = novaSenhaRaw.length > 0 ? novaSenhaRaw : null;
  if (novaSenha) {
    const policy = validatePasswordPolicy(novaSenha);
    if (!policy.valid) return fail("BAD_REQUEST", policy.message, 400);
  }
  const senhaHash = novaSenha ? hashPassword(novaSenha) : undefined;

  for (const vinculo of vinculos) {
    if (vinculo.tipo === "rh") {
      const pessoa = await prisma.colaboradorRH.findUnique({
        where: { id: vinculo.id },
        select: { cpfCnpj: true, cadastroEfetivado: true },
      });
      if (pessoa?.cadastroEfetivado === false) {
        return fail(
          "BAD_REQUEST",
          "Não é permitido vincular usuário a consultor em pré-cadastro. Efetive o cadastro no RH antes.",
          400
        );
      }
      if (!pessoa?.cpfCnpj) {
        return fail("BAD_REQUEST", "Pessoa vinculada sem CPF/CNPJ.", 400);
      }
      if (isCpf(pessoa.cpfCnpj) && pessoa.cpfCnpj.replace(/\D/g, "") !== cpfUsuario) {
        return fail("BAD_REQUEST", "Para vínculos com CPF, o CPF do usuário deve ser idêntico.", 400);
      }
    }
    if (vinculo.tipo === "cliente") {
      const cliente = await prisma.cliente.findUnique({
        where: { id: vinculo.id },
        select: { cpfCnpj: true },
      });
      if (!cliente?.cpfCnpj) {
        return fail("BAD_REQUEST", "Cliente vinculado sem CPF/CNPJ.", 400);
      }
      if (isCpf(cliente.cpfCnpj) && cliente.cpfCnpj.replace(/\D/g, "") !== cpfUsuario) {
        return fail("BAD_REQUEST", "Para vínculos com CPF, o CPF do usuário deve ser idêntico.", 400);
      }
    }
  }

  let updated = null as Awaited<ReturnType<typeof prisma.usuario.update>> | null;
  try {
    try {
      updated = await prisma.usuario.update({
        where: { id },
        data: {
          cpf: cpfUsuario,
          email: u.email.trim(),
          nomeExibicao: u.nomeExibicao ?? null,
          ...(senhaHash ? { senhaHash } : {}),
          perfilId: u.perfilId,
          ativo: u.ativo,
          vinculacaoTipo: vinculos[0]?.tipo ?? null,
          vinculacaoPessoaId: vinculos[0]?.id ?? null,
          vinculos: {
            deleteMany: {},
            createMany: {
              data: vinculos.map((v) => ({ tipo: v.tipo, pessoaId: v.id })),
            },
          },
          atualizadoEmSistema: new Date(),
        },
      });
    } catch {
      updated = await prisma.usuario.update({
        where: { id },
        data: {
          cpf: cpfUsuario,
          email: u.email.trim(),
          nomeExibicao: u.nomeExibicao ?? null,
          ...(senhaHash ? { senhaHash } : {}),
          perfilId: u.perfilId,
          ativo: u.ativo,
          vinculacaoTipo: vinculos[0]?.tipo ?? null,
          vinculacaoPessoaId: vinculos[0]?.id ?? null,
          atualizadoEmSistema: new Date(),
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("BAD_REQUEST", "CPF ou e-mail já cadastrado para outro usuário.", 400);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail("BAD_REQUEST", "Perfil ou vínculo informado não existe mais. Atualize a tela e tente novamente.", 400);
    }
    return fail("INTERNAL_ERROR", "Não foi possível atualizar o usuário.", 500);
  }

  try {
    await writeAuditLog(prisma, {
      usuarioId: updated.id,
      acao: "Usuário atualizado",
      modulo: "configuracoes",
      detalhes: `Usuário ${updated.nomeExibicao ?? updated.email}`,
    });
  } catch {
    // noop
  }
  const updatedWithVinculos = await prisma.usuario
    .findUnique({
      where: { id: updated.id },
      include: { vinculos: true },
    })
    .catch(() => null);
  return ok({ usuario: mapUsuario(updatedWithVinculos ?? updated) });
}

