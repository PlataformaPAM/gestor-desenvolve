import type { ColaboradorRH } from "@prisma/client";
import type { ColaboradorParceiro } from "@/lib/rh/types";
import type { Contato } from "@/lib/clientes/types";
import { RH_CONSULTOR_PRE_CADASTRO_CARGO } from "@/lib/rh/pre-cadastro-consultor";

function contatosFromJson(raw: unknown): Contato[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw as Contato[];
}

export function mapColaborador(
  c: ColaboradorRH & {
    dadosBancarios?: {
      banco: string | null;
      agencia: string | null;
      conta: string | null;
      tipoConta: string | null;
      pix: string | null;
    } | null;
    documentos?: Array<{ nome: string; url: string | null }>;
  }
): ColaboradorParceiro {
  const contatos = contatosFromJson((c as ColaboradorRH & { contatosFornecedor?: unknown }).contatosFornecedor);
  const rawEfetivado = (c as { cadastroEfetivado?: boolean }).cadastroEfetivado;
  let cadastroEfetivado: boolean;
  if (typeof rawEfetivado === "boolean") {
    cadastroEfetivado = rawEfetivado;
  } else if (
    c.tipoPessoa === "vendedor_externo" &&
    c.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO
  ) {
    cadastroEfetivado = false;
  } else {
    cadastroEfetivado = true;
  }
  return {
    id: c.id,
    nome: c.nome,
    cargoOuFuncao: c.cargoOuFuncao,
    tipoContrato: c.tipoContrato as ColaboradorParceiro["tipoContrato"],
    status: c.status as ColaboradorParceiro["status"],
    tipo: c.tipoPessoa as ColaboradorParceiro["tipo"],
    cadastroEfetivado,
    email: c.email ?? undefined,
    telefone: c.telefone ?? undefined,
    cpfCnpj: c.cpfCnpj ?? undefined,
    totalVendasMes: c.totalVendasMes ?? undefined,
    ultimoAcesso: c.ultimoAcesso?.toISOString(),
    dadosBancarios: c.dadosBancarios
      ? {
          banco: c.dadosBancarios.banco ?? undefined,
          agencia: c.dadosBancarios.agencia ?? undefined,
          conta: c.dadosBancarios.conta ?? undefined,
          tipoConta: (c.dadosBancarios.tipoConta as "corrente" | "poupanca" | null) ?? undefined,
          pix: c.dadosBancarios.pix ?? undefined,
        }
      : undefined,
    documentos: (c.documentos ?? []).map((d) => ({ nome: d.nome, url: d.url ?? undefined })),
    contatos: contatos?.length ? contatos : undefined,
  };
}

