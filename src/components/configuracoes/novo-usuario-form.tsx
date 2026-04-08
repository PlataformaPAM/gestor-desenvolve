"use client";

import { useState, useMemo, useEffect } from "react";
import type { UsuarioSistema, VinculacaoPessoa, PessoaParaVinculo } from "@/lib/configuracoes/types";
import type { PerfilAcesso } from "@/lib/configuracoes/types";
import { Switch } from "@/components/ui/switch";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { validatePasswordPolicy } from "@/lib/password-policy";

export type UsuarioFormPayload = Omit<UsuarioSistema, "id" | "criadoEm" | "atualizadoEm"> & {
  id?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  /** Só envio à API; não armazenar em estado global do app. */
  senha?: string;
};

type NovoUsuarioFormProps = {
  perfis: PerfilAcesso[];
  pessoasVinculo?: PessoaParaVinculo[];
  initialUsuario?: UsuarioSistema | null;
  onSave: (u: UsuarioFormPayload) => void;
  onCancel: () => void;
};

/** Normaliza termo para busca: minúsculas e, para números, só dígitos. */
function normalizarTermo(termo: string): { lower: string; apenasDigitos: string } {
  const t = termo.trim();
  return {
    lower: t.toLowerCase(),
    apenasDigitos: t.replace(/\D/g, ""),
  };
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function isCpf(documento: string): boolean {
  return apenasDigitos(documento).length === 11;
}

/** Filtro parcial: termo incluso no Nome ou no CPF/CNPJ, ignorando pontuação e case. */
function filtrarPessoasPorTermo<T extends { nome: string; cpfCnpj: string }>(
  pessoas: T[],
  termo: string
): T[] {
  if (!termo.trim()) return pessoas;
  const { lower, apenasDigitos } = normalizarTermo(termo);
  return pessoas.filter(
    (p) =>
      p.nome.toLowerCase().includes(lower) ||
      p.cpfCnpj.replace(/\D/g, "").includes(apenasDigitos)
  );
}

export function NovoUsuarioForm({
  perfis,
  pessoasVinculo = [],
  initialUsuario,
  onSave,
  onCancel,
}: NovoUsuarioFormProps) {
  const [cpf, setCpf] = useState(initialUsuario?.cpf ?? "");
  const [email, setEmail] = useState(initialUsuario?.email ?? "");
  const [nomeExibicao, setNomeExibicao] = useState(initialUsuario?.nomeExibicao ?? "");
  const [perfilId, setPerfilId] = useState(initialUsuario?.perfilId ?? perfis[0]?.id ?? "");
  const [ativo, setAtivo] = useState(initialUsuario?.ativo ?? true);
  const [vinculos, setVinculos] = useState<VinculacaoPessoa[]>(
    initialUsuario?.vinculos?.length
      ? initialUsuario.vinculos
      : initialUsuario?.vinculacao
        ? [initialUsuario.vinculacao]
        : []
  );
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [erroCpfVinculo, setErroCpfVinculo] = useState("");
  const [pendingRemoveVinculo, setPendingRemoveVinculo] = useState<PessoaParaVinculo | null>(null);
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novaSenhaConfirm, setNovaSenhaConfirm] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  useEffect(() => {
    if (initialUsuario) {
      setCpf(initialUsuario.cpf);
      setEmail(initialUsuario.email);
      setNomeExibicao(initialUsuario.nomeExibicao ?? "");
      setPerfilId(initialUsuario.perfilId);
      setAtivo(initialUsuario.ativo);
      setVinculos(
        initialUsuario.vinculos?.length
          ? initialUsuario.vinculos
          : initialUsuario.vinculacao
            ? [initialUsuario.vinculacao]
            : []
      );
      setSenha("");
      setSenhaConfirm("");
      setNovaSenha("");
      setNovaSenhaConfirm("");
      setErroSenha("");
    }
  }, [initialUsuario]);

  const pessoas = useMemo(() => pessoasVinculo, [pessoasVinculo]);
  const filtradas = useMemo(() => {
    if (!buscaVinculo.trim()) return pessoas.slice(0, 10);
    return filtrarPessoasPorTermo(pessoas, buscaVinculo).slice(0, 10);
  }, [pessoas, buscaVinculo]);

  const pessoasSelecionadas = useMemo(
    () =>
      vinculos
        .map((v) => pessoas.find((p) => p.id === v.id && p.tipo === v.tipo))
        .filter(Boolean) as PessoaParaVinculo[],
    [pessoas, vinculos]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf.trim() || !email.trim()) return;
    setErroSenha("");
    for (const pessoa of pessoasSelecionadas) {
      if (isCpf(pessoa.cpfCnpj) && apenasDigitos(cpf) !== apenasDigitos(pessoa.cpfCnpj)) {
        setErroCpfVinculo("Para vínculos com CPF, o CPF do usuário deve ser idêntico.");
        return;
      }
    }
    setErroCpfVinculo("");

    if (!initialUsuario) {
      if (!senha) {
        setErroSenha("Informe a senha inicial.");
        return;
      }
      if (senha !== senhaConfirm) {
        setErroSenha("A confirmação da senha não confere.");
        return;
      }
      const pol = validatePasswordPolicy(senha);
      if (!pol.valid) {
        setErroSenha(pol.message);
        return;
      }
    } else if (novaSenha || novaSenhaConfirm) {
      if (novaSenha !== novaSenhaConfirm) {
        setErroSenha("A confirmação da nova senha não confere.");
        return;
      }
      const pol = validatePasswordPolicy(novaSenha);
      if (!pol.valid) {
        setErroSenha(pol.message);
        return;
      }
    }

    const payload: UsuarioFormPayload = {
      cpf: cpf.trim(),
      email: email.trim(),
      nomeExibicao: nomeExibicao.trim() || undefined,
      perfilId: perfilId || (perfis[0]?.id ?? "admin"),
      ativo,
      vinculacao: vinculos[0] ?? undefined,
      vinculos: vinculos.length ? vinculos : undefined,
      atualizadoEm: new Date().toISOString(),
    };
    if (!initialUsuario) {
      payload.senha = senha;
    } else if (novaSenha) {
      payload.senha = novaSenha;
    }
    if (initialUsuario) {
      (payload as UsuarioFormPayload).id = initialUsuario.id;
      if (initialUsuario.criadoEm) (payload as UsuarioFormPayload).criadoEm = initialUsuario.criadoEm;
    }
    onSave(payload);
  };

  const isEdit = !!initialUsuario;

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Criação de contas é estritamente manual. O login (username) será sempre o CPF do usuário.
      </p>
      <div>
        <label htmlFor="cfg-cpf" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          CPF (Login) *
        </label>
        <input
          id="cfg-cpf"
          type="text"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          required
          readOnly={isEdit}
        />
        {isEdit && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            CPF não pode ser alterado na edição.
          </span>
        )}
      </div>
      <div>
        <label htmlFor="cfg-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          E-mail *
        </label>
        <input
          id="cfg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          required
        />
      </div>
      <div>
        <label htmlFor="cfg-nome" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nome para exibição
        </label>
        <input
          id="cfg-nome"
          type="text"
          value={nomeExibicao}
          onChange={(e) => setNomeExibicao(e.target.value)}
          placeholder="Nome completo ou apelido"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label htmlFor="cfg-perfil" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Perfil de acesso *
        </label>
        <select
          id="cfg-perfil"
          value={perfilId}
          onChange={(e) => setPerfilId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      {!isEdit && (
        <>
          <div>
            <label
              htmlFor="cfg-senha"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Senha inicial *
            </label>
            <input
              id="cfg-senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mín. 8 caracteres, maiúscula, minúscula e número"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
          <div>
            <label
              htmlFor="cfg-senha-confirm"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Confirmar senha *
            </label>
            <input
              id="cfg-senha-confirm"
              type="password"
              autoComplete="new-password"
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
        </>
      )}

      {isEdit && (
        <>
          <div className="flex items-center gap-2">
            <Switch
              checked={ativo}
              onCheckedChange={setAtivo}
              aria-label="Usuário ativo"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Usuário ativo
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              Alterar senha (opcional)
            </p>
            <div className="space-y-2">
              <input
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={novaSenhaConfirm}
                onChange={(e) => setNovaSenhaConfirm(e.target.value)}
                placeholder="Confirmar nova senha"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </>
      )}

      {/* Busca vínculo RH / Cliente (autocomplete) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Vincular a pessoa (RH ou Cliente)
        </label>
        <input
          type="text"
          value={buscaVinculo}
          onChange={(e) => setBuscaVinculo(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ (ex.: 456 encontra 123.456.789-00)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {vinculos.length > 0 && (
          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            {pessoasSelecionadas.map((p) => (
              <div
                key={`${p.tipo}-${p.id}`}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span>
                  Vínculo: {p.tipo === "rh" ? "RH" : "Cliente"} - {p.nome}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRemoveVinculo(p)}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
        {buscaVinculo && (
          <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
            {filtradas.map((p) => (
              <li key={`${p.tipo}-${p.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    const novoVinculo = p.tipo === "rh" ? { tipo: "rh" as const, id: p.id } : { tipo: "cliente" as const, id: p.id };
                    setVinculos((prev) => {
                      if (prev.some((v) => v.tipo === novoVinculo.tipo && v.id === novoVinculo.id)) return prev;
                      return [...prev, novoVinculo];
                    });
                    setBuscaVinculo("");
                    if (isCpf(p.cpfCnpj)) {
                      setCpf(p.cpfCnpj);
                    }
                    setErroCpfVinculo("");
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-950/40"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.nome}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {p.cpfCnpj} • {p.tipo === "rh" ? "RH" : "Cliente"}
                    {p.subtitulo ? ` — ${p.subtitulo}` : ""}
                  </span>
                </button>
              </li>
            ))}
            {filtradas.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">Nenhum resultado.</li>
            )}
          </ul>
        )}
        {erroCpfVinculo && (
          <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{erroCpfVinculo}</p>
        )}
      </div>

      {erroSenha && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {erroSenha}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          {isEdit ? "Salvar alterações" : "Salvar usuário"}
        </button>
      </div>
    </form>
    <AlertDialog
      open={!!pendingRemoveVinculo}
      onClose={() => setPendingRemoveVinculo(null)}
      onConfirm={() => {
        if (!pendingRemoveVinculo) return;
        const { tipo, id } = pendingRemoveVinculo;
        setVinculos((prev) => prev.filter((v) => !(v.tipo === tipo && v.id === id)));
        setPendingRemoveVinculo(null);
      }}
      title="Remover vínculo?"
      description={
        pendingRemoveVinculo ? (
          <>
            <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível neste formulário:</strong>{" "}
            o vínculo com <strong className="text-slate-900 dark:text-slate-100">{pendingRemoveVinculo.nome}</strong> (
            {pendingRemoveVinculo.tipo === "rh" ? "RH" : "Cliente"}) será removido. Ao salvar o usuário, a alteração fica
            permanente.
          </>
        ) : null
      }
      cancelLabel="Cancelar"
      confirmLabel="Sim, remover permanentemente"
      destructive
    />
    </>
  );
}
