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
  equipe_interna: "Equipe Interna (CLT/PJ)",
  vendedor_externo: "Vendedores/Externos",
  fornecedor_parceiro: "Fornecedores",
};
const TAB_LABELS_MOBILE: Record<TipoPessoaRH, string> = {
  equipe_interna: "Equipe",
  vendedor_externo: "Vendedores",
  fornecedor_parceiro: "Fornecedores",
};

function generateRhId(): string {
  return `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: {
            colaboradores?: ColaboradorParceiro[];
            usuarios?: { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[];
          };
        };
        if (!active) return;
        setColaboradores(data?.data?.colaboradores ?? []);
        setUsuariosParaVinculo(data?.data?.usuarios ?? []);
      } catch {
        // noop
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
      const data = (await bootstrap.json()) as {
        data?: {
          colaboradores?: ColaboradorParceiro[];
          usuarios?: { id: string; cpf: string; email?: string; nomeExibicao?: string; perfilId?: string }[];
        };
      };
      setColaboradores(data?.data?.colaboradores ?? []);
      setUsuariosParaVinculo(data?.data?.usuarios ?? []);
    }
    setIsCreateOpen(false);
  };

  const abrirPerfil = (c: ColaboradorParceiro) => {
    setSelected(c);
    setDrawerOpen(true);
  };

  const handleToggleStatus = async (colaborador: ColaboradorParceiro) => {
    const nextStatus: ColaboradorParceiro["status"] =
      colaborador.status === "inativo" ? "ativo" : "inativo";
    const atualizado: ColaboradorParceiro = { ...colaborador, status: nextStatus };
    setColaboradores((prev) => prev.map((c) => (c.id === colaborador.id ? atualizado : c)));
    const res = await fetch(`/api/rh/colaboradores/${colaborador.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador: atualizado }),
    });
    if (res.ok) return;
    setColaboradores((prev) => prev.map((c) => (c.id === colaborador.id ? colaborador : c)));
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
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ ou cargo..."
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
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

      <ColaboradoresTable
        lista={lista}
        onSelecionar={abrirPerfil}
        onToggleStatus={handleToggleStatus}
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
            lockTipo={tab === "fornecedor_parceiro"}
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
