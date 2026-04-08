import type { PessoaParaVinculo, UsuarioSistema } from "@/lib/configuracoes/types";

/** Preenche `nome` nos vínculos a partir da lista de pessoas (RH/Cliente). */
export function enrichUsuarioVinculos(
  u: UsuarioSistema,
  pessoas: PessoaParaVinculo[]
): UsuarioSistema {
  const lista =
    u.vinculos?.length ? u.vinculos : u.vinculacao ? [u.vinculacao] : [];
  if (!lista.length) return u;
  const vinculos = lista.map((v) => ({
    ...v,
    nome:
      pessoas.find((p) => p.id === v.id && p.tipo === v.tipo)?.nome ??
      ("nome" in v ? (v as { nome?: string }).nome : undefined),
  }));
  return {
    ...u,
    vinculos,
    vinculacao: vinculos[0],
  };
}
