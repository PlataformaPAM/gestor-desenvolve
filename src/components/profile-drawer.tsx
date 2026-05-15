"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, IdCard, Lock, Mail, Phone, Save, User, X } from "lucide-react";
import clsx from "clsx";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { useAuth } from "@/contexts/auth-context";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formModalSubmitButtonClass,
  formReadOnlyClass,
} from "@/components/ui/field-patterns";

type ProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  perfilId: string;
};

type TabId = "dados" | "seguranca";

function formatCpfDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return value.trim();
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function ProfileDrawer({ open, onClose, perfilId }: ProfileDrawerProps) {
  const { session } = useAuth();

  const [tab, setTab] = useState<TabId>("dados");
  const [nome, setNome] = useState(session.userName ?? "");
  const [email, setEmail] = useState(session.userEmail ?? "");
  const [telefone, setTelefone] = useState(session.userPhone ?? "");

  /* Sincroniza campos com a sessão sempre que o drawer abre. */
  /* eslint-disable react-hooks/set-state-in-effect -- sync explícito ao abrir o drawer */
  useEffect(() => {
    if (!open) return;
    setNome(session.userName ?? "");
    setEmail(session.userEmail ?? "");
    setTelefone(session.userPhone ?? "");
  }, [open, session.userName, session.userEmail, session.userPhone]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const nomeExibicao = session.userName ?? "Usuário";
  const cpfExibicao = formatCpfDisplay(session.userCpf);
  const perfilNome = perfilId ? "Perfil ativo" : "—";

  const salvarDados = () => {
    onClose();
  };

  const atualizarSenha = () => {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
    onClose();
  };

  const handleSalvarDados = (e: React.FormEvent) => {
    e.preventDefault();
    salvarDados();
  };

  const handleAtualizarSenha = (e: React.FormEvent) => {
    e.preventDefault();
    atualizarSenha();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "dados", label: "Meus Dados" },
    { id: "seguranca", label: "Segurança" },
  ];

  return (
    <DrawerSheet
      open={open}
      onClose={onClose}
      title="Meu Perfil"
      mobileContentPaddingClassName="px-0"
      desktopContentPaddingClassName="px-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Cabeçalho do perfil */}
        <div className="shrink-0 border-b border-slate-200 px-4 py-6 dark:border-slate-700 lg:px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-violet-700 text-2xl font-semibold text-white">
              {nomeExibicao.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{nomeExibicao}</p>
              <span className="mt-1.5 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                {perfilNome}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 flex shrink-0 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 lg:px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-[#6D28D9] text-[#6D28D9] dark:border-violet-400 dark:text-violet-300"
                  : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6">
            {tab === "dados" && (
              <form id="form-profile-dados" onSubmit={handleSalvarDados} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="profile-nome" className={formLabelClass}>
                    Nome
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-nome"
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoComplete="name"
                      className={`${formInputClass} pl-9`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="profile-email" className={formLabelClass}>
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className={`${formInputClass} pl-9`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="profile-tel" className={formLabelClass}>
                    Telefone
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-tel"
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      autoComplete="tel"
                      className={`${formInputClass} pl-9`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="profile-cpf" className={formLabelClass}>
                    CPF
                  </label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-cpf"
                      type="text"
                      value={cpfExibicao}
                      disabled
                      inputMode="numeric"
                      className={`${formReadOnlyClass} pl-9 font-mono`}
                    />
                  </div>
                </div>
              </form>
            )}

            {tab === "seguranca" && (
              <form id="form-profile-seguranca" onSubmit={handleAtualizarSenha} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Para atualizar sua senha, preencha os campos abaixo com a senha atual e a nova senha desejada.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="profile-senha-atual" className={formLabelClass}>
                    Senha atual
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Informe a senha que você usa hoje para entrar na plataforma.
                  </p>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-senha-atual"
                      type={showSenhaAtual ? "text" : "password"}
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Senha atual"
                      className={`${formInputClass} pl-9 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaAtual((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={showSenhaAtual ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="profile-nova-senha" className={formLabelClass}>
                    Nova senha
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use no mínimo 8 caracteres, com ao menos uma letra maiúscula, uma minúscula e um número.
                  </p>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-nova-senha"
                      type={showNovaSenha ? "text" : "password"}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Nova senha"
                      className={`${formInputClass} pl-9 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNovaSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={showNovaSenha ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="profile-confirmar-senha" className={formLabelClass}>
                    Confirmar nova senha
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Digite novamente a nova senha para garantir que não houve erro de digitação.
                  </p>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-confirmar-senha"
                      type={showConfirmar ? "text" : "password"}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repita a nova senha"
                      className={`${formInputClass} pl-9 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmar((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={showConfirmar ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:gap-3 lg:px-6">
            <button type="button" onClick={onClose} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
            {tab === "dados" ? (
              <button type="submit" form="form-profile-dados" className={formModalSubmitButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Salvar
                </span>
              </button>
            ) : (
              <button type="submit" form="form-profile-seguranca" className={formModalSubmitButtonClass}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  Atualizar senha
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </DrawerSheet>
  );
}
