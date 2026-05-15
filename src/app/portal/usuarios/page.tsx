"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { usePageHeader } from "@/contexts/page-header-context";
import { Search } from "lucide-react";
import { formInputClass } from "@/components/ui/field-patterns";
import { UsuariosTable } from "@/components/configuracoes/usuarios-table";
import { NovoUsuarioForm, type UsuarioFormPayload } from "@/components/configuracoes/novo-usuario-form";
import type { PerfilAcesso, UsuarioSistema, ModuloPermissao } from "@/lib/configuracoes/types";
import { PerfisAcessoTable } from "@/components/configuracoes/perfis-acesso-table";
import { PerfilForm, type PerfilFormPayload } from "@/components/configuracoes/perfil-form";
import { PORTAL_CLIENTE_PERFIL_LABELS, PORTAL_CLIENTE_PERFIL_MODULOS } from "@/lib/portal/cliente-perfil-modulos";

type PortalContextPayload = {
  user: { id: string; nome: string; isAdminCliente: boolean };
  clientes: Array<{ id: string; nome: string; empresa?: string }>;
};

type UsuarioPortal = {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  ativo: boolean;
  perfilId?: string;
  perfilNome: string;
  isAdminCliente?: boolean;
};

export default function PortalUsuariosPage() {
  const { setPrimaryAction } = usePageHeader();
  const [context, setContext] = useState<PortalContextPayload | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioPortal[]>([]);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [section, setSection] = useState<"usuarios" | "perfis">("usuarios");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [openNovoUsuario, setOpenNovoUsuario] = useState(false);
  const [openEditarUsuario, setOpenEditarUsuario] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioPortal | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [openNovoPerfil, setOpenNovoPerfil] = useState(false);
  const [openEditarPerfil, setOpenEditarPerfil] = useState(false);
  const [perfilEmEdicao, setPerfilEmEdicao] = useState<PerfilAcesso | null>(null);

  const usuariosTabela: UsuarioSistema[] = usuarios.map((u) => ({
    id: u.id,
    cpf: u.cpf,
    email: u.email,
    nomeExibicao: u.nome,
    perfilId: u.perfilNome,
    ativo: u.ativo,
  }));
  const perfisTabela: PerfilAcesso[] = useMemo(() => {
    if (perfis.length > 0) return perfis;
    return Array.from(new Set(usuarios.map((u) => u.perfilNome))).map((nome) => {
      const perfilId = usuarios.find((u) => u.perfilNome === nome)?.perfilId ?? nome;
      const permissoes: Record<ModuloPermissao, boolean> = {
        comercial: false,
        financeiro: false,
        tarefas: false,
        clientes: false,
        contratos: false,
        helpdesk: true,
        posVenda: false,
        solucoes: false,
        rh: false,
        configuracoes: false,
        relatorios: false,
        configuracoes_construtor_documentos: false,
        configuracoes_logs: false,
        configuracoes_perfis: false,
        configuracoes_usuarios: false,
        portal_cliente: false,
      };
      return {
        id: perfilId,
        nome,
        descricao: nome,
        permissoes,
      };
    });
  }, [perfis, usuarios]);
  const usuariosFiltrados = usuariosTabela
    .filter((u) => (mostrarInativos ? true : u.ativo))
    .filter((u) => {
      const term = filtroBusca.trim().toLowerCase();
      if (!term) return true;
      return `${u.nomeExibicao ?? ""} ${u.email} ${u.cpf}`.toLowerCase().includes(term);
    })
    .sort((a, b) => (a.nomeExibicao || a.email).localeCompare(b.nomeExibicao || b.email, "pt-BR", { sensitivity: "base" }));

  const load = useCallback(async () => {
    setErro(null);
    const [ctxRes, usuariosRes, perfisRes] = await Promise.all([
      fetch("/api/portal/context", { cache: "no-store" }),
      fetch("/api/portal/usuarios", { cache: "no-store" }),
      fetch("/api/portal/perfis", { cache: "no-store" }),
    ]);
    if (!ctxRes.ok) throw new Error("Não foi possível carregar o contexto do portal.");
    const ctxBody = (await ctxRes.json()) as { data?: PortalContextPayload };
    setContext(ctxBody.data ?? null);

    if (!usuariosRes.ok) throw new Error("Não foi possível carregar usuários da empresa.");
    const usuariosBody = (await usuariosRes.json()) as { data?: { usuarios?: UsuarioPortal[] } };
    setUsuarios(usuariosBody.data?.usuarios ?? []);
    if (perfisRes.ok) {
      const perfisBody = (await perfisRes.json()) as { data?: { perfis?: PerfilAcesso[] } };
      setPerfis(perfisBody.data?.perfis ?? []);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!active) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar usuários.");
      } finally {
        if (active) setCarregando(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!context?.user.isAdminCliente) {
      setPrimaryAction(null);
      return;
    }
    setPrimaryAction({
      label: section === "usuarios" ? "Novo Usuário" : "Novo Perfil",
      showPlusIcon: true,
      onClick: () => {
        if (section === "usuarios") setOpenNovoUsuario(true);
        if (section === "perfis") setOpenNovoPerfil(true);
      },
    });
    return () => setPrimaryAction(null);
  }, [context?.user.isAdminCliente, section, setPrimaryAction]);

  const onCriar = async (payload: UsuarioFormPayload) => {
    setErro(null);
    try {
      const res = await fetch("/api/portal/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: payload.nomeExibicao?.trim() || payload.email,
          email: payload.email,
          cpf: payload.cpf,
          senha: payload.senha,
          perfilId: payload.perfilId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Não foi possível criar usuário.");
      }
      setOpenNovoUsuario(false);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar usuário.");
    }
  };

  const onSalvarEdicao = async (payload: UsuarioFormPayload) => {
    if (!payload.id) return;
    setErro(null);
    try {
      const res = await fetch(`/api/portal/usuarios/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: payload.nomeExibicao,
          email: payload.email,
          ativo: payload.ativo,
          perfilId: payload.perfilId,
          senha: payload.senha,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Não foi possível atualizar usuário.");
      }
      setOpenEditarUsuario(false);
      setUsuarioEmEdicao(null);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar usuário.");
    }
  };

  const onCriarPerfil = async (payload: PerfilFormPayload) => {
    setErro(null);
    try {
      const res = await fetch("/api/portal/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Não foi possível criar perfil.");
      }
      setOpenNovoPerfil(false);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar perfil.");
    }
  };

  const onSalvarPerfil = async (payload: PerfilFormPayload) => {
    if (!payload.id) return;
    setErro(null);
    try {
      const res = await fetch(`/api/portal/perfis/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Não foi possível atualizar perfil.");
      }
      setOpenEditarPerfil(false);
      setPerfilEmEdicao(null);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar perfil.");
    }
  };

  if (carregando) return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando usuários...</p>;

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
          <label className="inline-flex shrink-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
            />
            Mostrar usuários inativos
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSection("usuarios")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${section === "usuarios" ? "border-violet-300 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/30" : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"}`}
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuários</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Gerencie os usuários do cliente.</p>
        </button>
        <button
          type="button"
          onClick={() => setSection("perfis")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${section === "perfis" ? "border-violet-300 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/30" : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"}`}
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Perfis de Acesso</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Crie perfis e permissões para sua equipe.</p>
        </button>
      </div>

      {erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
          {erro}
        </div>
      ) : null}

      {section === "usuarios" ? (
        <UsuariosTable
          usuarios={usuariosFiltrados}
          perfis={perfisTabela}
          hideVinculoColumn
          onEditar={
            context?.user.isAdminCliente
              ? (u) => {
                  const usuario = usuarios.find((item) => item.id === u.id);
                  if (!usuario) return;
                  setUsuarioEmEdicao(usuario);
                  setOpenEditarUsuario(true);
                }
              : undefined
          }
        />
      ) : (
        <PerfisAcessoTable
          perfis={perfis}
          readOnly
          allowedModules={PORTAL_CLIENTE_PERFIL_MODULOS}
          moduleLabels={PORTAL_CLIENTE_PERFIL_LABELS}
          onEditar={
            context?.user.isAdminCliente
              ? (p) => {
                  setPerfilEmEdicao(p);
                  setOpenEditarPerfil(true);
                }
              : undefined
          }
        />
      )}

      <DrawerSheet
        open={openEditarUsuario}
        onClose={() => {
          setOpenEditarUsuario(false);
          setUsuarioEmEdicao(null);
        }}
        title="Editar Usuário"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoUsuarioForm
            perfis={perfisTabela}
            pessoasVinculo={[]}
            hideVinculoSection
            initialUsuario={
              usuarioEmEdicao
                ? {
                    id: usuarioEmEdicao.id,
                    cpf: usuarioEmEdicao.cpf,
                    email: usuarioEmEdicao.email,
                    nomeExibicao: usuarioEmEdicao.nome,
                    perfilId: usuarioEmEdicao.perfilId ?? perfisTabela[0]?.id ?? "",
                    ativo: usuarioEmEdicao.ativo,
                  }
                : null
            }
            onSave={(payload) => {
              void onSalvarEdicao(payload);
            }}
            onCancel={() => {
              setOpenEditarUsuario(false);
              setUsuarioEmEdicao(null);
            }}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={openNovoUsuario}
        onClose={() => setOpenNovoUsuario(false)}
        title="Novo Usuário"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoUsuarioForm
            perfis={perfisTabela}
            pessoasVinculo={[]}
            hideVinculoSection
            onSave={(payload) => {
              void onCriar(payload);
            }}
            onCancel={() => setOpenNovoUsuario(false)}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={openNovoPerfil}
        onClose={() => setOpenNovoPerfil(false)}
        title="Novo Perfil"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PerfilForm
            allowedModules={PORTAL_CLIENTE_PERFIL_MODULOS}
            moduleLabels={PORTAL_CLIENTE_PERFIL_LABELS}
            onSave={(payload) => {
              void onCriarPerfil(payload);
            }}
            onCancel={() => setOpenNovoPerfil(false)}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={openEditarPerfil}
        onClose={() => {
          setOpenEditarPerfil(false);
          setPerfilEmEdicao(null);
        }}
        title="Editar Perfil"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PerfilForm
            initialPerfil={perfilEmEdicao}
            allowedModules={PORTAL_CLIENTE_PERFIL_MODULOS}
            moduleLabels={PORTAL_CLIENTE_PERFIL_LABELS}
            onSave={(payload) => {
              void onSalvarPerfil(payload);
            }}
            onCancel={() => {
              setOpenEditarPerfil(false);
              setPerfilEmEdicao(null);
            }}
          />
        </div>
      </DrawerSheet>
    </section>
  );
}

