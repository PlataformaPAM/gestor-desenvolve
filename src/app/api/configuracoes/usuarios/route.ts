import type { UsuarioSistema } from "@/lib/configuracoes/types";
import { prisma } from "@/lib/prisma";
import { mapUsuario } from "../_shared";
import { fail, ok, parseJsonSafe } from "@/lib/server/api-response";
import { writeAuditLog } from "@/lib/server/audit-log";
import { hashPassword, validatePasswordPolicy } from "@/lib/server/password";

type UsuarioCreateBody = UsuarioSistema & { senha?: string };

export async function POST(req: Request) {
  const body = await parseJsonSafe<{ usuario?: UsuarioCreateBody }>(req);
  if (!body.ok) return fail("BAD_REQUEST", "JSON inválido.", 400);
  const payload = body.value;
  const u = payload.usuario;
  if (!u?.cpf || !u.email || !u.perfilId) {
    return fail("BAD_REQUEST", "Usuário inválido.", 400);
  }
  const senha = typeof u.senha === "string" ? u.senha : "";
  if (!senha) {
    return fail("BAD_REQUEST", "Senha inicial é obrigatória.", 400);
  }
  const policy = validatePasswordPolicy(senha);
  if (!policy.valid) return fail("BAD_REQUEST", policy.message, 400);
  const senhaHash = hashPassword(senha);

  const cpfUsuario = u.cpf.replace(/\D/g, "");
  const isCpf = (doc?: string | null) => (doc ?? "").replace(/\D/g, "").length === 11;
  const vinculos = (u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : []).filter(
    (v): v is { tipo: "rh" | "cliente"; id: string } => Boolean(v?.tipo && v?.id)
  );
  for (const vinculo of vinculos) {
    if (vinculo.tipo === "rh") {
      const pessoa = await prisma.colaboradorRH.findUnique({
        where: { id: vinculo.id },
        select: { cpfCnpj: true },
      });
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

  let created = null as Awaited<ReturnType<typeof prisma.usuario.create>> | null;
  try {
    created = await prisma.usuario.create({
      data: {
        cpf: cpfUsuario,
        email: u.email.trim(),
        nomeExibicao: u.nomeExibicao ?? null,
        senhaHash,
        perfilId: u.perfilId,
        ativo: u.ativo ?? true,
        vinculacaoTipo: vinculos[0]?.tipo ?? null,
        vinculacaoPessoaId: vinculos[0]?.id ?? null,
        vinculos: vinculos.length
          ? {
              createMany: {
                data: vinculos.map((v) => ({ tipo: v.tipo, pessoaId: v.id })),
              },
            }
          : undefined,
        criadoEm: u.criadoEm ? new Date(u.criadoEm) : new Date(),
        atualizadoEmSistema: new Date(),
      },
    });
  } catch {
    created = await prisma.usuario.create({
      data: {
        cpf: cpfUsuario,
        email: u.email.trim(),
        nomeExibicao: u.nomeExibicao ?? null,
        senhaHash,
        perfilId: u.perfilId,
        ativo: u.ativo ?? true,
        vinculacaoTipo: vinculos[0]?.tipo ?? null,
        vinculacaoPessoaId: vinculos[0]?.id ?? null,
        criadoEm: u.criadoEm ? new Date(u.criadoEm) : new Date(),
        atualizadoEmSistema: new Date(),
      },
    });
  }

  await writeAuditLog(prisma, {
    usuarioId: created.id,
    acao: "Usuário criado",
    modulo: "configuracoes",
    detalhes: `Usuário ${created.nomeExibicao ?? created.email}`,
  });

  const createdWithVinculos = await prisma.usuario.findUnique({
    where: { id: created.id },
    include: { vinculos: true },
  });
  return ok({ usuario: mapUsuario(createdWithVinculos ?? created) }, 201);
}

