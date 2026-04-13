"use client";

import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { ColaboradoresTable } from "@/components/rh/colaboradores-table";
import { PerfilColaboradorDrawer } from "@/components/rh/perfil-colaborador-drawer";
import { NovoColaboradorForm } from "@/components/rh/novo-colaborador-form";
import { usePageHeader } from "@/contexts/page-header-context";
import type { ColaboradorParceiro, TipoPessoaRH } from "@/lib/rh/types";
import type { NovoColaboradorPayload } from "@/components/rh/novo-colaborador-form";

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

function generateRhId(): string {
  return `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
      const statusOrder = prioridadeStatus(a.status) - prioridadeStatus(b.status);
      if (statusOrder !== 0) return statusOrder;
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });
  }, [colaboradores, tab, busca, mostrarInativos]);

  useEffect(() => {
    setPrimaryAction({
      label: "Nova Pessoa",
      onClick: () => setIsCreateOpen(true),
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

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

  const handleNovoColaborador = async (payload: NovoColaboradorPayload) => {
    const created: ColaboradorParceiro = { ...payload, id: generateRhId() };
    const res = await fetch("/api/rh/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador: created }),
    });
    if (!res.ok) {
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        alert(err?.error?.message || "Não foi possível salvar o fornecedor.");
      } catch {
        alert("Não foi possível salvar o fornecedor.");
      }
      return;
    }
    const bootstrap = await fetch("/api/rh/bootstrap", { cache: "no-store" });
    if (bootstrap.ok) {
      const { colaboradores: c, usuarios: u } = extrairRhBootstrap(await bootstrap.json());
      setColaboradores(c);
      setUsuariosParaVinculo(u);
    }
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
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        alert(err?.error?.message || "Não foi possível salvar a edição.");
      } catch {
        alert("Não foi possível salvar a edição.");
      }
      return;
    }
    setIsEditOpen(false);
  };

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
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
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
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex -mb-px gap-1 overflow-x-auto whitespace-nowrap" aria-label="Abas RH">
          {(Object.entries(TAB_LABELS) as [TipoPessoaRH, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === value
                  ? "border-[#6D28D9] text-[#6D28D9] dark:border-violet-400/60 dark:text-violet-200"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
              }`}
            >
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
        onSelecionar={abrirPerfil}
      />

      <DrawerSheet
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelected(null);
        }}
        title={selected ? selected.nome : "Perfil"}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PerfilColaboradorDrawer
            colaborador={selected}
            usuarios={usuariosParaVinculo}
            onEditarDados={() => setIsEditOpen(true)}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Nova Pessoa / Novo Colaborador */}
      <DrawerSheet
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nova Pessoa"
      >
        <div className="overflow-y-auto">
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
      >
        <div className="overflow-y-auto">
          <NovoColaboradorForm
            key={selected?.id ?? "edit"}
            initialValues={selected ? { ...selected } : null}
            onSave={handleSalvarEdicao}
            onCancel={() => setIsEditOpen(false)}
          />
        </div>
      </DrawerSheet>
    </section>
  );
}
