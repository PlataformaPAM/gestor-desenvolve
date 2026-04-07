import type { ClienteEndereco } from "./types";

/** Resposta ViaCEP (campos usados) */
type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

/**
 * Consulta CEP na ViaCEP (8 dígitos).
 * Preenche: logradouro, bairro, cidade, uf. CEP formatado XXXXX-XXX.
 */
export async function fetchViaCep(cep: string): Promise<Partial<ClienteEndereco> | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;

    const formatCep = `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
    return {
      cep: formatCep,
      logradouro: data.logradouro ?? "",
      numero: "",
      complemento: data.complemento ?? undefined,
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
