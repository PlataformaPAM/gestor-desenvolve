"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, Users, Handshake, Building2 } from "lucide-react";
import { formInputClass, formLabelClass, formModalCancelButtonClass, formModalSubmitButtonClass } from "@/components/ui/field-patterns";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { Toast } from "@/components/ui/toast";
import { ColaboradoresTable } from "@/components/rh/colaboradores-table";
import { NovoColaboradorForm } from "@/components/rh/novo-colaborador-form";
import { usePageHeader } from "@/contexts/page-header-context";
import { useAuth } from "@/contexts/auth-context";
import { useRhColaboradoresRbac } from "@/hooks/use-rbac-resource";
import { useRouter } from "next/navigation";
import type { ColaboradorParceiro, TipoPessoaRH, TipoContrato } from "@/lib/rh/types";
import type { NovoColaboradorPayload } from "@/components/rh/novo-colaborador-form";
import { TIPO_CONTRATO_LABELS, TIPO_CONTRATO_OPCOES_CONSULTOR } from "@/lib/rh/constants";
import { normalizeNomeRh, RH_CONSULTOR_PRE_CADASTRO_CARGO } from "@/lib/rh/pre-cadastro-consultor";

const TAB_LABELS: Record<TipoPessoaRH, string> = {
  equipe_interna: "Equipe",
  vendedor_externo: "Consultores",
  fornecedor_parceiro: "Fornecedores",
};
const TAB_LABELS_MOBILE: Record<TipoPessoaRH, string> = {
  equipe_interna: "Equipe",
  vendedor_externo: "Consultores",
  fornecedor_parceiro: "Fornecedores",
};

const OPCOES_TIPO_CONTRATO_CONSULTOR_SORTED = [...TIPO_CONTRATO_OPCOES_CONSULTOR].sort((a, b) =>
  TIPO_CONTRATO_LABELS[a].localeCompare(TIPO_CONTRATO_LABELS[b], "pt-BR", { sensitivity: "base" })
);

function ordenarMatchesNomeDuplicado(matches: ColaboradorParceiro[]): ColaboradorParceiro[] {
  return [...matches].sort((a, b) => {
    const pa = a.cadastroEfetivado === false ? 1 : 0;
    const pb = b.cadastroEfetivado === false ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}

function generateRhId(): string {
  return `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function isPreCadastroConsultorPayload(p: NovoColaboradorPayload): boolean {
  if (p.tipo !== "vendedor_externo") return false;
  if (p.cadastroEfetivado !== false) return false;
  const doc = (p.cpfCnpj ?? "").replace(/\D/g, "");
  if (doc.length > 0) return false;
  return p.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO;
}

/** Resposta de `/api/rh/bootstrap`: `data` pode trazer `colaboradores` no nível principal ou só dentro de `data.data`. */
function extrairRhBootstrap(json: unknown): {
  colaboradores: ColaboradorParceiro[];
  usuarios: { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[];
} {
  const root = json as {
    data?: {
      colaboradores?: ColaboradorParceiro[];
      usuarios?: { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[];
      data?: {
        colaboradores?: ColaboradorParceiro[];
        usuarios?: { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[];
      };
    };
  };
  const p = root?.data;
  const nested = p?.data;
  const colaboradores =
    (Array.isArray(p?.colaboradores) ? p.colaboradores : null) ??
    (Array.isArray(nested?.colaboradores) ? nested.colaboradores : null) ??
    [];
  const usuarios =
    (Array.isArray(p?.usuarios) ? p.usuarios : null) ??
    (Array.isArray(nested?.usuarios) ? nested.usuarios : null) ??
    [];
  return { colaboradores, usuarios };
}

export default function RHPage() {
  const router = useRouter();
  const { session } = useAuth();
  const rbac = useRhColaboradoresRbac();
  const { setPrimaryAction } = usePageHeader();
  const [colaboradores, setColaboradores] = useState<ColaboradorParceiro[]>([]);
  const [usuariosParaVinculo, setUsuariosParaVinculo] = useState<
    { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[]
  >([]);
  const [tab, setTab] = useState<TipoPessoaRH>("equipe_interna");
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [selected, setSelected] = useState<ColaboradorParceiro | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [erroCarregarRh, setErroCarregarRh] = useState<string | null>(null);
  const [dupSalvando, setDupSalvando] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupNome, setDupNome] = useState("");
  const [dupTipoContrato, setDupTipoContrato] = useState<TipoContrato>("consultor");
  const [dupMatches, setDupMatches] = useState<ColaboradorParceiro[]>([]);
  const [dupSubstituirId, setDupSubstituirId] = useState<string>("");
  const [dupIrParaId, setDupIrParaId] = useState<string>("");
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: "success" | "error" }>({
    visible: false,
    message: "",
    variant: "success",
  });

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ visible: false, message: "", variant });
    window.requestAnimationFrame(() => setToast({ visible: true, message, variant }));
  }, []);

  const lista = useMemo(() => {
    let items = colaboradores.filter(
      (c) => c.tipo === tab && (mostrarInativos ? true : c.status === "ativo")
    );
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const qNum = q.replace(/\D/g, "");
      items = items.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.cargoOuFuncao || "").toLowerCase().includes(q) ||
          (c.cpfCnpj || "").replace(/\D/g, "").includes(qNum)
      );
    }
    const prioridadeStatus = (status: ColaboradorParceiro["status"]) =>
      status === "ativo" ? 0 : 1;
    return [...items].sort((a, b) => {
      if (tab === "vendedor_externo") {
        const preA = a.cadastroEfetivado === false ? 1 : 0;
        const preB = b.cadastroEfetivado === false ? 1 : 0;
        if (preA !== preB) return preA - preB;
      }
      const statusOrder = prioridadeStatus(a.status) - prioridadeStatus(b.status);
      if (statusOrder !== 0) return statusOrder;
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });
  }, [colaboradores, tab, busca, mostrarInativos]);

  useEffect(() => {
    if (!session.perfilId && !session.isSystemAdmin) return;
    if (!rbac.podeVer) {
      router.replace("/");
      return;
    }
  }, [session.perfilId, session.isSystemAdmin, rbac.podeVer, router]);

  useEffect(() => {
    if (!rbac.podeCriar) {
      setPrimaryAction(null);
      return () => setPrimaryAction(null);
    }
    setPrimaryAction({
      label: "Nova Pessoa",
      onClick: () => setIsCreateOpen(true),
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, rbac.podeCriar]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/rh/bootstrap", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setErroCarregarRh("Não foi possível carregar as pessoas do RH. Atualize a página ou tente novamente.");
          setColaboradores([]);
          setUsuariosParaVinculo([]);
          return;
        }
        setErroCarregarRh(null);
        const json = await res.json();
        if (!active) return;
        const { colaboradores: c, usuarios: u } = extrairRhBootstrap(json);
        setColaboradores(c);
        setUsuariosParaVinculo(u);
      } catch {
        if (!active) return;
        setErroCarregarRh("Falha ao carregar o RH. Verifique a conexão e atualize a página.");
        setColaboradores([]);
        setUsuariosParaVinculo([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [modalHostReady, setModalHostReady] = useState(false);
  useEffect(() => {
    setModalHostReady(true);
  }, []);

  const reloadRhBootstrap = useCallback(async () => {
    const res = await fetch("/api/rh/bootstrap", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const { colaboradores: c, usuarios: u } = extrairRhBootstrap(json);
    setColaboradores(c);
    setUsuariosParaVinculo(u);
  }, []);

  const executarPostPreCadastro = useCallback(
    async (nome: string, tipoContrato: TipoContrato) => {
      const res = await fetch("/api/rh/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preCadastroConsultor: true,
          colaborador: { nome: nome.trim(), tipoContrato, tipo: "vendedor_externo" },
        }),
      });
      if (!res.ok) {
        let msg = "Não foi possível salvar o pré-cadastro.";
        try {
          const j = (await res.json()) as { error?: { message?: string } };
          if (j?.error?.message) msg = j.error.message;
        } catch {
          /* resposta não JSON */
        }
        showToast(msg, "error");
        return false;
      }
      await reloadRhBootstrap();
      return true;
    },
    [reloadRhBootstrap, showToast]
  );

  const handleNovoColaborador = async (payload: NovoColaboradorPayload) => {
    if (tab === "vendedor_externo" && isPreCadastroConsultorPayload(payload)) {
      const nome = payload.nome.trim();
      const matches = colaboradores.filter(
        (c) => c.tipo === "vendedor_externo" && normalizeNomeRh(c.nome) === normalizeNomeRh(nome)
      );
      if (matches.length > 0) {
        const sorted = ordenarMatchesNomeDuplicado(matches);
        const preAlvos = sorted.filter((c) => c.cadastroEfetivado === false);
        setDupMatches(sorted);
        setDupNome(nome);
        setDupTipoContrato(payload.tipoContrato);
        setDupSubstituirId(preAlvos[0]?.id ?? "");
        setDupIrParaId(sorted[0]?.id ?? "");
        setDupOpen(true);
        return;
      }
      const ok = await executarPostPreCadastro(nome, payload.tipoContrato);
      if (ok) {
        showToast("Pré-cadastro salvo com sucesso.", "success");
        setIsCreateOpen(false);
      }
      return;
    }

    const created: ColaboradorParceiro = { ...payload, id: generateRhId() };
    const res = await fetch("/api/rh/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador: created }),
    });
    if (!res.ok) {
      let msg = "Não foi possível salvar a pessoa.";
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j?.error?.message) msg = j.error.message;
      } catch {
        /* ignore */
      }
      showToast(msg, "error");
      return;
    }
    const bootstrap = await fetch("/api/rh/bootstrap", { cache: "no-store" });
    if (bootstrap.ok) {
      const { colaboradores: c, usuarios: u } = extrairRhBootstrap(await bootstrap.json());
      setColaboradores(c);
      setUsuariosParaVinculo(u);
    }
    showToast("Cadastro salvo com sucesso.", "success");
    setIsCreateOpen(false);
  };

  const abrirPerfil = (c: ColaboradorParceiro) => {
    setSelected(c);
    setDrawerOpen(true);
  };

  const handleSalvarEdicao = async (payload: NovoColaboradorPayload) => {
    if (!selected) return;
    const atualizado: ColaboradorParceiro = {
      ...selected,
      ...payload,
      id: selected.id,
    };
    setColaboradores((prev) => prev.map((c) => (c.id === selected.id ? atualizado : c)));
    setSelected(atualizado);
    const res = await fetch(`/api/rh/colaboradores/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador: atualizado }),
    });
    if (!res.ok) {
      setColaboradores((prev) => prev.map((c) => (c.id === selected.id ? selected : c)));
      setSelected(selected);
      let msg = "Não foi possível salvar a edição.";
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j?.error?.message) msg = j.error.message;
      } catch {
        /* ignore */
      }
      showToast(msg, "error");
      return;
    }
    showToast("Alterações salvas com sucesso.", "success");
    setIsEditOpen(false);
  };

  const dupPreAlvos = useMemo(
    () => dupMatches.filter((c) => c.tipo === "vendedor_externo" && c.cadastroEfetivado === false),
    [dupMatches]
  );

  const onDupSubstituir = async () => {
    const id = dupSubstituirId;
    const target = colaboradores.find((c) => c.id === id);
    if (!target || target.cadastroEfetivado !== false) {
      showToast("Escolha um pré-cadastro na lista para substituir, ou use outra opção.", "error");
      return;
    }
    setDupSalvando(true);
    try {
      const cargo =
        target.cargoOuFuncao === RH_CONSULTOR_PRE_CADASTRO_CARGO ||
        !(target.cargoOuFuncao ?? "").trim()
          ? RH_CONSULTOR_PRE_CADASTRO_CARGO
          : target.cargoOuFuncao;
      const atualizado: ColaboradorParceiro = {
        ...target,
        nome: dupNome.trim(),
        tipoContrato: dupTipoContrato,
        cargoOuFuncao: cargo,
        cadastroEfetivado: false,
      };
      const res = await fetch(`/api/rh/colaboradores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaborador: atualizado }),
      });
      if (!res.ok) {
        let msg = "Não foi possível atualizar o registro.";
        try {
          const j = (await res.json()) as { error?: { message?: string } };
          if (j?.error?.message) msg = j.error.message;
        } catch {
          /* ignore */
        }
        showToast(msg, "error");
        return;
      }
      await reloadRhBootstrap();
      setDupOpen(false);
      setIsCreateOpen(false);
      showToast("Pré-cadastro atualizado.", "success");
    } finally {
      setDupSalvando(false);
    }
  };

  const onDupCadastrarMesmoAssim = async () => {
    setDupSalvando(true);
    try {
      const ok = await executarPostPreCadastro(dupNome, dupTipoContrato);
      if (ok) {
        setDupOpen(false);
        setIsCreateOpen(false);
        showToast("Pré-cadastro salvo com sucesso.", "success");
      }
    } finally {
      setDupSalvando(false);
    }
  };

  const onDupIrAoExistente = () => {
    const c = colaboradores.find((x) => x.id === dupIrParaId) ?? dupMatches[0];
    if (!c) return;
    setDupOpen(false);
    setIsCreateOpen(false);
    setSelected(c);
    setDrawerOpen(true);
  };

  const modalOverlay = (className: string, onBackdrop: () => void, children: ReactNode) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] dark:bg-black/50"
        onClick={onBackdrop}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(ev) => ev.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return (
    <section className="w-full min-w-0 space-y-6">
      {/* Header: título, busca, botão (botão principal fica no GlobalHeader) */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:max-w-lg sm:flex-row sm:items-center">
          <div className="relative min-w-0 w-full sm:w-[520px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ ou cargo..."
              className={`${formInputClass} h-10 min-w-0 pl-9`}
            />
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9] dark:border-slate-600 dark:bg-slate-800"
            />
            Mostrar pessoas inativas
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-30 border-b border-slate-300 bg-slate-50/95 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95">
        <nav className="flex gap-1 overflow-x-auto whitespace-nowrap px-1" aria-label="Abas RH">
          {(Object.entries(TAB_LABELS) as [TipoPessoaRH, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`relative inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors ${
                tab === value
                  ? "text-[#6D28D9] dark:text-violet-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              {value === "equipe_interna" ? <Users className="h-4 w-4" /> : null}
              {value === "vendedor_externo" ? <Handshake className="h-4 w-4" /> : null}
              {value === "fornecedor_parceiro" ? <Building2 className="h-4 w-4" /> : null}
              {tab === value ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6D28D9]" /> : null}
              <span className="sm:hidden">{TAB_LABELS_MOBILE[value]}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {erroCarregarRh && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {erroCarregarRh}
        </div>
      )}
      {lista.length === 0 && colaboradores.length > 0 && !erroCarregarRh && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Nenhuma pessoa nesta aba. As listas de <strong className="font-medium text-slate-800 dark:text-slate-100">Equipe</strong>,{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-100">Consultores</strong> e{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-100">Fornecedores</strong> são separadas — troque de aba para
          encontrar o cadastro.
        </p>
      )}
      <ColaboradoresTable
        lista={lista}
        variant={tab === "equipe_interna" ? "equipe" : "default"}
        showPreCadastroBadge={tab === "vendedor_externo"}
        onSelecionar={abrirPerfil}
      />

      <DrawerSheet
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelected(null);
        }}
        title={
          selected
            ? `${selected.tipo === "equipe_interna" ? "Equipe" : selected.tipo === "vendedor_externo" ? "Consultor" : "Fornecedor"}: ${selected.nome}`
            : "Perfil"
        }
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoColaboradorForm
            key={selected?.id ?? "view-edit"}
            initialValues={selected ? { ...selected } : null}
            onSave={handleSalvarEdicao}
            permitirSalvar={rbac.podeEditar}
            onCancel={() => {
              setDrawerOpen(false);
              setSelected(null);
            }}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Nova Pessoa / Novo Colaborador */}
      <DrawerSheet
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nova Pessoa"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoColaboradorForm
            key={`create-${tab}`}
            defaultTipo={tab}
            lockTipo={
              tab === "fornecedor_parceiro" || tab === "equipe_interna" || tab === "vendedor_externo"
            }
            onSave={handleNovoColaborador}
            onCancel={() => setIsCreateOpen(false)}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={selected ? `Editar ${selected.nome}` : "Editar Pessoa"}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NovoColaboradorForm
            key={selected?.id ?? "edit"}
            initialValues={selected ? { ...selected } : null}
            onSave={handleSalvarEdicao}
            permitirSalvar={rbac.podeEditar}
            onCancel={() => setIsEditOpen(false)}
          />
        </div>
      </DrawerSheet>

      {modalHostReady && typeof document !== "undefined" && dupOpen
        ? createPortal(
            modalOverlay("max-w-lg", () => {
              if (!dupSalvando) setDupOpen(false);
            }, (
              <div className="space-y-4">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Nome já usado em consultor
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Já existe pelo menos um consultor com o mesmo nome (comparação sem diferenciar maiúsculas).
                        Confira se é a mesma pessoa e escolha uma ação.
                      </p>
                      <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-600 dark:bg-slate-800/50">
                        {dupMatches.map((m) => (
                          <li key={m.id} className="text-slate-800 dark:text-slate-200">
                            <span className="font-medium">{m.nome}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {" "}
                              — {m.cadastroEfetivado === false ? "Pré-cadastro" : "Cadastro efetivado"}
                              {m.cpfCnpj ? ` — ${m.cpfCnpj}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="rh-dup-nome" className={formLabelClass}>
                            Nome a gravar
                          </label>
                          <input
                            id="rh-dup-nome"
                            value={dupNome}
                            onChange={(e) => setDupNome(e.target.value)}
                            className={formInputClass}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="rh-dup-tipo" className={formLabelClass}>
                            Tipo de contrato
                          </label>
                          <select
                            id="rh-dup-tipo"
                            value={dupTipoContrato}
                            onChange={(e) => setDupTipoContrato(e.target.value as TipoContrato)}
                            className={formInputClass}
                          >
                            {OPCOES_TIPO_CONTRATO_CONSULTOR_SORTED.map((tc) => (
                              <option key={tc} value={tc}>
                                {TIPO_CONTRATO_LABELS[tc]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {dupMatches.length > 1 ? (
                          <div className="sm:col-span-2">
                            <label htmlFor="rh-dup-abrir" className={formLabelClass}>
                              Qual registro abrir?
                            </label>
                            <select
                              id="rh-dup-abrir"
                              value={dupIrParaId}
                              onChange={(e) => setDupIrParaId(e.target.value)}
                              className={formInputClass}
                            >
                              {dupMatches.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome} ({m.cadastroEfetivado === false ? "pré" : "efetivado"})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        {dupPreAlvos.length > 1 ? (
                          <div className="sm:col-span-2">
                            <label htmlFor="rh-dup-sub" className={formLabelClass}>
                              Qual pré-cadastro substituir?
                            </label>
                            <select
                              id="rh-dup-sub"
                              value={dupSubstituirId}
                              onChange={(e) => setDupSubstituirId(e.target.value)}
                              className={formInputClass}
                            >
                              {dupPreAlvos.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome} — {m.id.slice(0, 8)}…
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={formModalSubmitButtonClass}
                            disabled={dupSalvando}
                            onClick={() => void onDupIrAoExistente()}
                          >
                            Ir ao cadastro existente
                          </button>
                          <button
                            type="button"
                            className={`${formModalSubmitButtonClass} bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500`}
                            disabled={dupSalvando}
                            onClick={() => void onDupCadastrarMesmoAssim()}
                          >
                            Cadastrar mesmo assim
                          </button>
                          <button
                            type="button"
                            className={formModalSubmitButtonClass}
                            disabled={dupSalvando || dupPreAlvos.length === 0}
                            title={
                              dupPreAlvos.length === 0
                                ? "Só é possível substituir um pré-cadastro. Cadastros já efetivados devem ser editados na ficha."
                                : undefined
                            }
                            onClick={() => void onDupSubstituir()}
                          >
                            Substituir pré-cadastro
                          </button>
                        </div>
                        <button
                          type="button"
                          className={formModalCancelButtonClass}
                          disabled={dupSalvando}
                          onClick={() => setDupOpen(false)}
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
            )),
            document.body
          )
        : null}

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
