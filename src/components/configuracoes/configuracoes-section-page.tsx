"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { formInputClass } from "@/components/ui/field-patterns";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { UsuariosTable } from "@/components/configuracoes/usuarios-table";
import { PerfisAcessoTable } from "@/components/configuracoes/perfis-acesso-table";
import { LogsTable } from "@/components/configuracoes/logs-table";
import { NovoUsuarioForm } from "@/components/configuracoes/novo-usuario-form";
import { PerfilForm } from "@/components/configuracoes/perfil-form";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import type { UsuarioSistema, PerfilAcesso, LogSistema } from "@/lib/configuracoes/types";
import type { PessoaParaVinculo } from "@/lib/configuracoes/types";
import type { UsuarioFormPayload } from "@/components/configuracoes/novo-usuario-form";
import type { PerfilFormPayload } from "@/components/configuracoes/perfil-form";
import { enrichUsuarioVinculos } from "@/lib/configuracoes/enrich-usuario-vinculos";
import { ConfiguracoesTopNav } from "@/components/configuracoes/configuracoes-top-nav";
import {
  useConfiguracoesResourceRbac,
  useConfiguracoesSectionGuard,
} from "@/hooks/use-rbac-resource";

type ConfiguracoesSection = "usuarios" | "perfis" | "logs";

const SECTION_RESOURCE: Record<ConfiguracoesSection, string> = {
  usuarios: "configuracoes.usuarios",
  perfis: "configuracoes.perfis",
  logs: "configuracoes.logs",
};

function generateUserId(): string {
  return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ConfiguracoesSectionPage({ section }: { section: ConfiguracoesSection }) {
  const resourceId = SECTION_RESOURCE[section];
  useConfiguracoesSectionGuard(resourceId);
  const rbac = useConfiguracoesResourceRbac(resourceId);
  const { setPrimaryAction } = usePageHeader();
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
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  };

  useEffect(() => {
    if (section === "logs" || !rbac.podeCriar) {
      setPrimaryAction(null);
      return () => setPrimaryAction(null);
    }
    setPrimaryAction({
      label: section === "usuarios" ? "Novo Usuário" : "Novo Perfil",
      onClick: () => {
        if (section === "usuarios") setDrawerNovoUsuarioOpen(true);
        if (section === "perfis") setDrawerNovoPerfilOpen(true);
      },
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, section, rbac.podeCriar]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/configuracoes/bootstrap", { cache: "no-store" });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          showToast(err?.error?.message ?? "Não foi possível carregar perfis e usuários.", "error");
          return;
        }
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
        setUsuarios((data?.data?.usuarios ?? []).map((u) => enrichUsuarioVinculos(u, pv)));
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
          showToast(json?.error?.message ?? "Não foi possível atualizar o usuário.", "error");
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
        showToast(json?.error?.message ?? "Não foi possível criar o usuário.", "error");
        return;
      }
      const servidor = json?.data?.usuario;
      if (servidor) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === tempId ? enrichUsuarioVinculos(servidor, pessoasVinculo) : u))
        );
      }
      showToast("Usuário criado com sucesso.", "success");
    })();
  };

  const handleSalvarPerfil = (payload: PerfilFormPayload) => {
    void (async () => {
      if (payload.id) {
        const next = perfis.find((p) => p.id === payload.id);
        if (!next) return;
        const perfilPayload: PerfilAcesso = {
          ...next,
          id: payload.id,
          nome: payload.nome,
          descricao: payload.descricao,
          permissoes: payload.permissoes,
          permissoesGranulares: payload.permissoesGranulares,
        };
        const res = await fetch(`/api/configuracoes/perfis/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfil: perfilPayload }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { perfil?: PerfilAcesso };
          error?: { message?: string };
        };
        if (!res.ok) {
          showToast(json?.error?.message ?? "Não foi possível atualizar o perfil.", "error");
          return;
        }
        const servidor = json?.data?.perfil;
        setPerfis((prev) =>
          prev.map((p) => (p.id === payload.id ? (servidor ?? perfilPayload) : p))
        );
        setDrawerEditarPerfilOpen(false);
        setPerfilEmEdicao(null);
        showToast("Perfil atualizado com sucesso.", "success");
        return;
      }

      const tempId = `temp-perfil-${Date.now()}`;
      const optimistic: PerfilAcesso = {
        id: tempId,
        nome: payload.nome,
        descricao: payload.descricao,
        permissoes: payload.permissoes,
        permissoesGranulares: payload.permissoesGranulares,
      };
      setPerfis((prev) => [optimistic, ...prev]);
      setDrawerNovoPerfilOpen(false);

      const res = await fetch("/api/configuracoes/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfil: {
            nome: payload.nome,
            descricao: payload.descricao,
            permissoes: payload.permissoes,
            permissoesGranulares: payload.permissoesGranulares,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { perfil?: PerfilAcesso };
        error?: { message?: string };
      };
      if (!res.ok) {
        setPerfis((prev) => prev.filter((p) => p.id !== tempId));
        showToast(json?.error?.message ?? "Não foi possível criar o perfil.", "error");
        return;
      }
      const servidor = json?.data?.perfil;
      if (servidor) {
        setPerfis((prev) => prev.map((p) => (p.id === tempId ? servidor : p)));
      }
      showToast("Perfil criado com sucesso.", "success");
    })();
  };

  const usuariosFiltrados = useMemo(() => {
    const base = mostrarInativosUsuarios ? usuarios : usuarios.filter((u) => u.ativo);
    const term = filtroBusca.trim().toLowerCase();
    const filtrados = term
      ? base.filter((u) => [u.nomeExibicao ?? "", u.email ?? "", u.cpf ?? ""].join(" ").toLowerCase().includes(term))
      : base;
    return [...filtrados].sort((a, b) =>
      (a.nomeExibicao || a.email).localeCompare(b.nomeExibicao || b.email, "pt-BR", { sensitivity: "base" })
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
      [l.acao, l.modulo, l.detalhes, l.usuarioNome, l.usuarioCpf].filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [logs, filtroBusca]);

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="sticky top-0 z-10 flex w-full min-w-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:max-w-lg sm:flex-row sm:items-center">
          <div className="relative min-w-0 w-full sm:w-[520px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar..."
              className={`${formInputClass} h-10 min-w-0 pl-9`}
            />
          </div>
          {section === "usuarios" && (
            <label className="inline-flex shrink-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
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
        <ConfiguracoesTopNav />
      </div>

      {section === "usuarios" && (
        <UsuariosTable
          usuarios={usuariosFiltrados}
          perfis={perfis}
          pessoasVinculo={pessoasVinculo}
          onEditar={
            rbac.podeEditar
              ? (u) => {
                  setUsuarioEmEdicao(u);
                  setDrawerEditarUsuarioOpen(true);
                }
              : undefined
          }
        />
      )}
      {section === "perfis" && (
        <PerfisAcessoTable
          perfis={perfisFiltrados}
          onEditar={
            rbac.podeEditar
              ? (p) => {
                  setPerfilEmEdicao(p);
                  setDrawerEditarPerfilOpen(true);
                }
              : undefined
          }
          readOnly={!rbac.podeEditar}
        />
      )}
      {section === "logs" && <LogsTable logs={logsFiltrados} />}

      <DrawerSheet
        open={drawerNovoUsuarioOpen}
        onClose={() => setDrawerNovoUsuarioOpen(false)}
        title="Novo usuário"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoUsuarioForm
            perfis={perfis}
            pessoasVinculo={pessoasVinculo}
            onSave={handleSalvarUsuario}
            onCancel={() => setDrawerNovoUsuarioOpen(false)}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={drawerEditarUsuarioOpen}
        onClose={() => {
          setDrawerEditarUsuarioOpen(false);
          setUsuarioEmEdicao(null);
        }}
        title="Editar usuário"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

      <DrawerSheet
        open={drawerNovoPerfilOpen}
        onClose={() => setDrawerNovoPerfilOpen(false)}
        title="Novo perfil"
        scrollBody={false}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PerfilForm onSave={handleSalvarPerfil} onCancel={() => setDrawerNovoPerfilOpen(false)} />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={drawerEditarPerfilOpen}
        onClose={() => {
          setDrawerEditarPerfilOpen(false);
          setPerfilEmEdicao(null);
        }}
        title="Editar perfil"
        scrollBody={false}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        duration={toast.variant === "error" ? 7000 : 3000}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </section>
  );
}
