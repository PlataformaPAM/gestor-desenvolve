import type { Cliente, ClienteEndereco, Contato } from "@/lib/clientes/types";
import {
  applyInstitutionalCityName,
  normalizeCep,
  normalizeEmail,
  normalizeProperName,
  normalizeUf,
  toPortugueseTitleCase,
} from "@/lib/text/portuguese-text";

type ClienteLike = Omit<Cliente, "id"> & { id?: string; contatos?: Contato[] };

function normalizeEndereco(endereco: ClienteEndereco): ClienteEndereco {
  return {
    ...endereco,
    logradouro: normalizeProperName(endereco.logradouro),
    numero: collapseNumero(endereco.numero),
    complemento: endereco.complemento?.trim()
      ? normalizeProperName(endereco.complemento)
      : endereco.complemento,
    bairro: normalizeProperName(endereco.bairro),
    cidade: normalizeProperName(endereco.cidade),
    uf: normalizeUf(endereco.uf),
    cep: normalizeCep(endereco.cep),
  };
}

function collapseNumero(value: string): string {
  return value.trim();
}

export function normalizeContato(contato: Contato): Contato {
  return {
    ...contato,
    nome: normalizeProperName(contato.nome),
    email: normalizeEmail(contato.email),
    telefone: contato.telefone.trim(),
    setor: contato.setor?.trim() ? normalizeProperName(contato.setor) : contato.setor,
    cargo: contato.cargo?.trim() ? normalizeProperName(contato.cargo) : contato.cargo,
  };
}

function normalizeNomeEmpresaFields(
  nome: string,
  empresa: string,
  officialCity: string | null
): { nome: string; empresa: string } {
  let nomeNorm = normalizeProperName(nome);
  let empresaNorm = normalizeProperName(empresa);

  if (officialCity) {
    nomeNorm = applyInstitutionalCityName(nomeNorm, officialCity);
    empresaNorm = applyInstitutionalCityName(empresaNorm, officialCity);
  }

  return { nome: nomeNorm, empresa: empresaNorm };
}

/** Normalização síncrona (caixa, acentos comuns, e-mail, UF). */
export function normalizeClienteTextFields<T extends ClienteLike>(cliente: T): T {
  const endereco = cliente.endereco ? normalizeEndereco(cliente.endereco) : undefined;
  const { nome, empresa } = normalizeNomeEmpresaFields(
    cliente.nome,
    cliente.empresa,
    null
  );

  return {
    ...cliente,
    nome: nome || empresa,
    empresa: empresa || nome,
    email: cliente.email ? normalizeEmail(cliente.email) : cliente.email,
    telefone: cliente.telefone?.trim() || cliente.telefone,
    urlSiteOficial: cliente.urlSiteOficial?.trim() || cliente.urlSiteOficial,
    endereco,
    contatos: (cliente.contatos ?? []).map(normalizeContato),
  };
}

/** Normalização com nome oficial de município (IBGE/Extrator), quando disponível. */
export function normalizeClienteWithOfficialCity<T extends ClienteLike>(
  cliente: T,
  officialCity: string | null
): T {
  const base = normalizeClienteTextFields(cliente);
  if (!officialCity) return base;

  const endereco = base.endereco
    ? { ...base.endereco, cidade: officialCity }
    : base.endereco;

  const { nome, empresa } = normalizeNomeEmpresaFields(base.nome, base.empresa, officialCity);

  return {
    ...base,
    nome,
    empresa,
    endereco,
  };
}

/** Aplica title case em um campo único (útil no blur do formulário). */
export function normalizeClienteFieldValue(
  field: "nome" | "empresa" | "logradouro" | "bairro" | "cidade" | "complemento" | "setor" | "cargo",
  value: string
): string {
  if (field === "cidade") return toPortugueseTitleCase(value);
  return normalizeProperName(value);
}
