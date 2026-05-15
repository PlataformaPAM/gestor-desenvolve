"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { UsuarioSistema, VinculacaoPessoa, PessoaParaVinculo } from "@/lib/configuracoes/types";
import type { PerfilAcesso } from "@/lib/configuracoes/types";
import { Switch } from "@/components/ui/switch";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableOption } from "@/components/ui/searchable-select";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
} from "@/components/ui/field-patterns";
import { buildProfileColorMap } from "@/lib/configuracoes/profile-color-map";
import {
  Eye,
  EyeOff,
  IdCard,
  Lock,
  Mail,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

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
  hideVinculoSection?: boolean;
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

function labelTipoVinculoPessoa(pessoa: PessoaParaVinculo): string {
  if (pessoa.tipo === "cliente") return "Cliente";
  if (pessoa.rhTipo === "vendedor_externo") return "RH - Consultor";
  if (pessoa.rhTipo === "fornecedor_parceiro") return "RH - Fornecedor";
  return "RH - Equipe";
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
  hideVinculoSection = false,
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
  const [showSenhaInicial, setShowSenhaInicial] = useState(false);
  const [showSenhaConfirm, setShowSenhaConfirm] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showNovaSenhaConfirm, setShowNovaSenhaConfirm] = useState(false);
  const vinculoPickerRef = useRef<HTMLDivElement | null>(null);

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
  const perfilColorById = useMemo(() => buildProfileColorMap(perfis), [perfis]);
  const perfilOptions = useMemo<SearchableOption[]>(
    () =>
      perfis.map((p) => {
        const color = perfilColorById.get(p.id);
        const ColoredProfileIcon = ({ className }: { className?: string }) => (
          <ShieldCheck
            className={className ?? "h-4 w-4"}
            style={{ color: color?.color }}
            aria-hidden
          />
        );
        return { value: p.id, label: p.nome, icon: ColoredProfileIcon };
      }),
    [perfis, perfilColorById]
  );

  useEffect(() => {
    if (!buscaVinculo.trim()) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!vinculoPickerRef.current) return;
      if (!vinculoPickerRef.current.contains(event.target as Node)) {
        setBuscaVinculo("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [buscaVinculo]);

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
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Criação de contas é estritamente manual. O login (username) será sempre o CPF do usuário.
        </p>
        <div>
          <label htmlFor="cfg-cpf" className={formLabelClass}>
            CPF (Login) <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="cfg-cpf"
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className={`${formInputClass} pl-9`}
              required
              readOnly={isEdit}
            />
          </div>
          {isEdit && (
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              CPF não pode ser alterado na edição.
            </span>
          )}
        </div>
        <div>
          <label htmlFor="cfg-email" className={formLabelClass}>
            E-mail <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="cfg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className={`${formInputClass} pl-9`}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="cfg-nome" className={formLabelClass}>
            Nome para exibição
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="cfg-nome"
              type="text"
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Nome completo ou apelido"
              className={`${formInputClass} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="cfg-perfil" className={formLabelClass}>
            Perfil de acesso <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <SearchableSelect
            options={perfilOptions}
            value={perfilId}
            onChange={setPerfilId}
            placeholder="Selecionar perfil..."
            searchPlaceholder="Buscar perfil..."
            leadingIcon={ShieldCheck}
          />
        </div>

        {!isEdit && (
          <>
            <div>
              <label htmlFor="cfg-senha" className={formLabelClass}>
                Senha inicial <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="cfg-senha"
                  type={showSenhaInicial ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mín. 8 caracteres, maiúscula, minúscula e número"
                  className={`${formInputClass} pl-9 pr-11`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaInicial((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showSenhaInicial ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSenhaInicial ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="relative">
              <label htmlFor="cfg-senha-confirm" className={formLabelClass}>
                Confirmar senha <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="cfg-senha-confirm"
                  type={showSenhaConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={senhaConfirm}
                  onChange={(e) => setSenhaConfirm(e.target.value)}
                  placeholder="Repita a senha inicial"
                  className={`${formInputClass} pl-9 pr-11`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showSenhaConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                >
                  {showSenhaConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        {isEdit && (
          <>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} aria-label="Usuário ativo" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Usuário ativo
              </span>
            </div>
            <p className={formLabelClass}>Alterar senha (opcional)</p>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNovaSenha ? "text" : "password"}
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Nova senha"
                  className={`${formInputClass} pl-9 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showNovaSenha ? "Ocultar nova senha" : "Mostrar nova senha"}
                >
                  {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNovaSenhaConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={novaSenhaConfirm}
                  onChange={(e) => setNovaSenhaConfirm(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className={`${formInputClass} pl-9 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenhaConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showNovaSenhaConfirm ? "Ocultar confirmação da nova senha" : "Mostrar confirmação da nova senha"}
                >
                  {showNovaSenhaConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        {!hideVinculoSection && (
          <div ref={vinculoPickerRef}>
            <label className={formLabelClass}>Vincular a pessoa (RH ou Cliente)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={buscaVinculo}
                onChange={(e) => setBuscaVinculo(e.target.value)}
                placeholder="Buscar por nome ou CPF/CNPJ (ex.: 456 encontra 123.456.789-00)"
                className={`${formInputClass} pl-9`}
              />
            </div>
        {vinculos.length > 0 && (
          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            {pessoasSelecionadas.map((p) => (
              <div
                key={`${p.tipo}-${p.id}`}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="inline-flex items-center gap-2">
                  {p.tipo === "rh" ? <User className="h-4 w-4 text-fuchsia-500" /> : <Users className="h-4 w-4 text-cyan-500" />}
                  Vínculo: {p.tipo === "rh" ? "RH" : "Cliente"} - {p.nome}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRemoveVinculo(p)}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <Trash2 className="h-4 w-4" />
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
                    {p.cpfCnpj} • {labelTipoVinculoPessoa(p)}
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
        )}

        {erroSenha && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {erroSenha}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
        <button type="button" onClick={onCancel} className={formModalCancelButtonClass}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar
          </span>
        </button>
        <button type="submit" className={formModalSubmitButtonClass}>
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </span>
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
