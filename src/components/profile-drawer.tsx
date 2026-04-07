"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { useAuth } from "@/contexts/auth-context";

type ProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  perfilId: string;
};

type TabId = "dados" | "seguranca";

export function ProfileDrawer({ open, onClose, perfilId }: ProfileDrawerProps) {
  const { session } = useAuth();

  const [tab, setTab] = useState<TabId>("dados");
  const [nome, setNome] = useState(session.userName ?? "");
  const [email, setEmail] = useState(session.userEmail ?? "");
  const [telefone, setTelefone] = useState(session.userPhone ?? "");

  useEffect(() => {
    if (open) {
      setNome(session.userName ?? "");
      setEmail(session.userEmail ?? "");
      setTelefone(session.userPhone ?? "");
    }
  }, [open, session.userName, session.userEmail, session.userPhone]);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const nomeExibicao = session.userName ?? "Usuário";
  const cpfExibicao = session.userCpf ?? "—";
  const perfilNome = perfilId ? "Perfil ativo" : "—";

  const handleSalvarDados = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleAtualizarSenha = (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
    onClose();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "dados", label: "Meus Dados" },
    { id: "seguranca", label: "Segurança" },
  ];

  return (
    <DrawerSheet open={open} onClose={onClose} title="Meu Perfil">
      <div className="flex flex-col overflow-hidden">
        {/* Cabeçalho do perfil: avatar, nome, badge */}
        <div className="border-b border-slate-200 px-4 py-6 dark:border-slate-700 lg:px-6">
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
        <div className="flex border-b border-slate-200 px-4 dark:border-slate-700 lg:px-6">
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {tab === "dados" && (
            <form onSubmit={handleSalvarDados} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telefone</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">CPF</label>
                <input
                  type="text"
                  value={cpfExibicao}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
                  title="Credencial única de acesso, não editável."
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#6D28D9] py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
              >
                Salvar Alterações
              </button>
            </form>
          )}

          {tab === "seguranca" && (
            <form onSubmit={handleAtualizarSenha} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Senha Atual</label>
                <div className="relative">
                  <input
                    type={showSenhaAtual ? "text" : "password"}
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-12 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label={showSenhaAtual ? "Ocultar" : "Mostrar"}
                  >
                    {showSenhaAtual ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showNovaSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-12 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label={showNovaSenha ? "Ocultar" : "Mostrar"}
                  >
                    {showNovaSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Nova Senha</label>
                <div className="relative">
                  <input
                    type={showConfirmar ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-12 text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmar((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label={showConfirmar ? "Ocultar" : "Mostrar"}
                  >
                    {showConfirmar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#6D28D9] py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
              >
                Atualizar Senha
              </button>
            </form>
          )}
        </div>
      </div>
    </DrawerSheet>
  );
}
