"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { UsuariosTable } from "@/components/configuracoes/usuarios-table";
import { PerfisAcessoTable } from "@/components/configuracoes/perfis-acesso-table";
import { LogsTable } from "@/components/configuracoes/logs-table";
import { NovoUsuarioForm } from "@/components/configuracoes/novo-usuario-form";
import { PerfilForm } from "@/components/configuracoes/perfil-form";
import { usePageHeader } from "@/contexts/page-header-context";
import type { UsuarioSistema, PerfilAcesso, LogSistema } from "@/lib/configuracoes/types";
import type { PessoaParaVinculo } from "@/lib/configuracoes/types";
import type { UsuarioFormPayload } from "@/components/configuracoes/novo-usuario-form";
import type { PerfilFormPayload } from "@/components/configuracoes/perfil-form";
import { enrichUsuarioVinculos } from "@/lib/configuracoes/enrich-usuario-vinculos";

type TabConfig = "usuarios" | "perfis" | "logs";
const TAB_LABELS_MOBILE: Record<TabConfig, string> = {
  usuarios: "Usuários",
  perfis: "Perfis",
  logs: "Logs",
};

function generateUserId(): string {
  return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generatePerfilId(nome: string): string {
  const slug = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return slug || `perfil-${Date.now()}`;
}

export default function ConfiguracoesPage() {
  const { setPrimaryAction } = usePageHeader();
  const [tab, setTab] = useState<TabConfig>("usuarios");
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [pessoasVinculo, setPessoasVinculo] = useState<PessoaParaVinculo[]>([]);
  const [drawerNovoUsuarioOpen, setDrawerNovoUsuarioOpen] = useState(false);
  const [drawerEditarUsuarioOpen, setDrawerEditarUsuarioOpen] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioSistema | null>(null);
  const [drawerNovoPerfilOpen, setDrawerNovoPerfilOpen] = useState(false);
  const [drawerEditarPerfilOpen, setDrawerEditarPerfilOpen] = useState(false);
  const [perfilEmEdicao, setPerfilEmEdicao] = useState<PerfilAcesso | null>(null);
  const [mostrarInativosUsuarios, setMostrarInativosUsuarios] = useState(false);
  const [filtroBusca, setFiltroBusca] = useState("");

  useEffect(() => {
    setPrimaryAction({
      label: tab === "usuarios" ? "Novo Usuário" : tab === "perfis" ? "Novo Perfil" : "Novo",
      onClick: () => {
        if (tab === "usuarios") setDrawerNovoUsuarioOpen(true);
        if (tab === "perfis") setDrawerNovoPerfilOpen(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, tab]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/configuracoes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: {
            usuarios?: UsuarioSistema[];
            perfis?: PerfilAcesso[];
            logs?: LogSistema[];
            pessoasVinculo?: PessoaParaVinculo[];
          };
        };
        if (!active) return;
        const pv = data?.data?.pessoasVinculo ?? [];
        setUsuarios(
          (data?.data?.usuarios ?? []).map((u) => enrichUsuarioVinculos(u, pv))
        );
        setPerfis(data?.data?.perfis ?? []);
        setLogs(data?.data?.logs ?? []);
        setPessoasVinculo(pv);
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSalvarUsuario = (payload: UsuarioFormPayload) => {
    void (async () => {
      if (payload.id) {
        const next = usuarios.find((u) => u.id === payload.id);
        if (!next) return;
        const { senha: _omitSenha, ...withoutSenha } = payload;
        const res = await fetch(`/api/configuracoes/usuarios/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario: {
              ...next,
              ...payload,
              atualizadoEm: payload.atualizadoEm ?? new Date().toISOString(),
            },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { usuario?: UsuarioSistema };
          error?: { message?: string };
        };
        if (!res.ok) {
          alert(json?.error?.message ?? "Não foi possível atualizar o usuário.");
          return;
        }
        const servidor = json?.data?.usuario;
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === payload.id
              ? enrichUsuarioVinculos(servidor ?? { ...next, ...withoutSenha }, pessoasVinculo)
              : u
          )
        );
        setDrawerEditarUsuarioOpen(false);
        setUsuarioEmEdicao(null);
        return;
      }

      const { senha, ...rest } = payload;
      const tempId = generateUserId();
      const optimistic = enrichUsuarioVinculos(
        {
          ...rest,
          id: tempId,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        } as UsuarioSistema,
        pessoasVinculo
      );
      setUsuarios((prev) => [optimistic, ...prev]);
      setDrawerNovoUsuarioOpen(false);

      const res = await fetch("/api/configuracoes/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: { ...rest, senha } }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { usuario?: UsuarioSistema };
        error?: { message?: string };
      };
      if (!res.ok) {
        setUsuarios((prev) => prev.filter((u) => u.id !== tempId));
        alert(json?.error?.message ?? "Não foi possível criar o usuário.");
        return;
      }
      const servidor = json?.data?.usuario;
      if (servidor) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === tempId ? enrichUsuarioVinculos(servidor, pessoasVinculo) : u))
        );
      }
    })();
  };

  const handleEditarUsuario = (u: UsuarioSistema) => {
    setUsuarioEmEdicao(u);
    setDrawerEditarUsuarioOpen(true);
  };

  const handleSalvarPerfil = (payload: PerfilFormPayload) => {
    if (payload.id) {
      const next = perfis.find((p) => p.id === payload.id);
      setPerfis((prev) =>
        prev.map((p) =>
          p.id === payload.id
            ? { ...p, nome: payload.nome, descricao: payload.descricao, permissoes: payload.permissoes }
            : p
        )
      );
      if (next) {
        void fetch(`/api/configuracoes/perfis/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perfil: { ...next, nome: payload.nome, descricao: payload.descricao, permissoes: payload.permissoes },
          }),
        });
      }
      setDrawerEditarPerfilOpen(false);
      setPerfilEmEdicao(null);
    } else {
      const id = generatePerfilId(payload.nome);
      const created: PerfilAcesso = { id, nome: payload.nome, descricao: payload.descricao, permissoes: payload.permissoes };
      setPerfis((prev) => [
        created,
        ...prev,
      ]);
      void fetch("/api/configuracoes/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: created }),
      });
      setDrawerNovoPerfilOpen(false);
    }
  };

  const handleEditarPerfil = (p: PerfilAcesso) => {
    setPerfilEmEdicao(p);
    setDrawerEditarPerfilOpen(true);
  };

  const tabs: { id: TabConfig; label: string }[] = [
    { id: "usuarios", label: "Usuários" },
    { id: "perfis", label: "Perfis de Acesso" },
    { id: "logs", label: "Logs do Sistema" },
  ];

  const usuariosFiltrados = useMemo(() => {
    const base = mostrarInativosUsuarios ? usuarios : usuarios.filter((u) => u.ativo);
    const term = filtroBusca.trim().toLowerCase();
    const filtrados = term
      ? base.filter((u) =>
          [u.nomeExibicao ?? "", u.email ?? "", u.cpf ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : base;
    return [...filtrados].sort((a, b) =>
      (a.nomeExibicao || a.email).localeCompare(b.nomeExibicao || b.email, "pt-BR", {
        sensitivity: "base",
      })
    );
  }, [usuarios, mostrarInativosUsuarios, filtroBusca]);
  const perfisFiltrados = useMemo(() => {
    const term = filtroBusca.trim().toLowerCase();
    if (!term) return perfis;
    return perfis.filter((p) => `${p.nome} ${p.descricao}`.toLowerCase().includes(term));
  }, [perfis, filtroBusca]);
  const logsFiltrados = useMemo(() => {
    const term = filtroBusca.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((l) =>
      [l.acao, l.modulo, l.detalhes, l.usuarioNome, l.usuarioCpf]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs, filtroBusca]);

  return (
    <section className="w-full min-w-0 space-y-6">
      <div
        className={
          tab === "usuarios"
            ? "flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:gap-3"
            : "w-full min-w-0"
        }
      >
        <div className={`relative min-w-0 ${tab === "usuarios" ? "flex-1 sm:max-w-lg" : "w-full sm:max-w-sm"}`}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="Buscar em configurações..."
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        {tab === "usuarios" && (
          <label className="inline-flex shrink-0 items-center gap-2 self-start text-sm text-slate-700 sm:self-center">
            <input
              type="checkbox"
              checked={mostrarInativosUsuarios}
              onChange={(e) => setMostrarInativosUsuarios(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
            />
            Mostrar usuários inativos
          </label>
        )}
      </div>
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px gap-1 overflow-x-auto whitespace-nowrap" aria-label="Abas Configurações">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-[#6D28D9] text-[#6D28D9]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <span className="sm:hidden">{TAB_LABELS_MOBILE[t.id]}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {tab === "usuarios" && (
        <div className="space-y-3">
          <UsuariosTable
            usuarios={usuariosFiltrados}
            perfis={perfis}
            pessoasVinculo={pessoasVinculo}
            onEditar={handleEditarUsuario}
          />
        </div>
      )}
      {tab === "perfis" && (
        <PerfisAcessoTable
          perfis={perfisFiltrados}
          onEditar={handleEditarPerfil}
          readOnly
        />
      )}
      {tab === "logs" && <LogsTable logs={logsFiltrados} />}

      {/* Drawer: Novo Usuário */}
      <DrawerSheet
        open={drawerNovoUsuarioOpen}
        onClose={() => setDrawerNovoUsuarioOpen(false)}
        title="Novo usuário"
      >
        <div className="overflow-y-auto">
          <NovoUsuarioForm
            perfis={perfis}
            pessoasVinculo={pessoasVinculo}
            onSave={handleSalvarUsuario}
            onCancel={() => setDrawerNovoUsuarioOpen(false)}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Editar Usuário */}
      <DrawerSheet
        open={drawerEditarUsuarioOpen}
        onClose={() => {
          setDrawerEditarUsuarioOpen(false);
          setUsuarioEmEdicao(null);
        }}
        title="Editar usuário"
      >
        <div className="overflow-y-auto">
          <NovoUsuarioForm
            perfis={perfis}
            pessoasVinculo={pessoasVinculo}
            initialUsuario={usuarioEmEdicao}
            onSave={handleSalvarUsuario}
            onCancel={() => {
              setDrawerEditarUsuarioOpen(false);
              setUsuarioEmEdicao(null);
            }}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Novo Perfil */}
      <DrawerSheet
        open={drawerNovoPerfilOpen}
        onClose={() => setDrawerNovoPerfilOpen(false)}
        title="Novo Perfil"
      >
        <div className="overflow-y-auto">
          <PerfilForm
            onSave={handleSalvarPerfil}
            onCancel={() => setDrawerNovoPerfilOpen(false)}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Editar Perfil */}
      <DrawerSheet
        open={drawerEditarPerfilOpen}
        onClose={() => {
          setDrawerEditarPerfilOpen(false);
          setPerfilEmEdicao(null);
        }}
        title="Editar Perfil"
      >
        <div className="overflow-y-auto">
          <PerfilForm
            initialPerfil={perfilEmEdicao}
            onSave={handleSalvarPerfil}
            onCancel={() => {
              setDrawerEditarPerfilOpen(false);
              setPerfilEmEdicao(null);
            }}
          />
        </div>
      </DrawerSheet>
    </section>
  );
}
