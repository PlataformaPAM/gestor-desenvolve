"use client";

import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { ClientesTable } from "@/components/clientes/clientes-table";
import { ClienteFormSheet } from "@/components/clientes/cliente-form-sheet";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Toast } from "@/components/ui/toast";
import { usePageHeader } from "@/contexts/page-header-context";
import { STATUS_LABELS } from "@/lib/clientes/constants";
import type { Cliente, ClienteStatus } from "@/lib/clientes/types";

const STATUS_OPTIONS: { value: "" | ClienteStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ativo", label: STATUS_LABELS.ativo },
  { value: "inativo", label: STATUS_LABELS.inativo },
  { value: "inadimplente", label: STATUS_LABELS.inadimplente },
];

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function ClientesPage() {
  const { setPrimaryAction } = usePageHeader();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ClienteStatus>("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
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
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/clientes/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { clientes?: Cliente[] } };
        if (!active) return;
        setClientes(data?.data?.clientes ?? []);
      } catch {
        // noop
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPrimaryAction({
      label: "Novo Cliente",
      onClick: () => {
        setSelectedCliente(null);
        setFormSheetOpen(true);
      },
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const filteredClientes = useMemo(() => {
    const term = normalizeForSearch(searchTerm);
    const filtrados = clientes.filter((c) => {
      if (!mostrarInativos && c.status === "inativo") return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (term) {
        const nome = normalizeForSearch(c.nome);
        const empresa = normalizeForSearch(c.empresa ?? "");
        const cnpj = normalizeForSearch(c.cpfCnpj ?? "");
        const matchNomeOuCnpj = nome.includes(term) || empresa.includes(term) || cnpj.includes(term);
        const matchContato = (c.contatos ?? []).some((cont) =>
          normalizeForSearch(cont.nome ?? "").includes(term)
        );
        if (!matchNomeOuCnpj && !matchContato) return false;
      }
      return true;
    });
    return filtrados.sort((a, b) => {
      const nomeA = (a.empresa || a.nome || "").trim();
      const nomeB = (b.empresa || b.nome || "").trim();
      return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
    });
  }, [clientes, searchTerm, statusFilter, mostrarInativos]);

  const handleSaveCliente = (cliente: Cliente) => {
    const isNew = !clientes.some((c) => c.id === cliente.id);
    const snapshotBefore = clientes;
    setClientes((prev) => {
      const idx = prev.findIndex((c) => c.id === cliente.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = cliente;
        return next;
      }
      return [...prev, cliente];
    });
    void (async () => {
      try {
        const url = isNew ? "/api/clientes" : `/api/clientes/${cliente.id}`;
        const method = isNew ? "POST" : "PATCH";
        const body = isNew ? { cliente: { ...cliente, contatos: cliente.contatos ?? [] } } : { cliente };
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!res.ok) {
          setClientes(snapshotBefore);
          showToast(json.error?.message ?? "Não foi possível salvar o cliente.", "error");
          return;
        }
        const bootstrap = await fetch("/api/clientes/bootstrap", { cache: "no-store" });
        if (!bootstrap.ok) {
          setClientes(snapshotBefore);
          showToast("Cliente salvo, mas não foi possível recarregar a lista. Atualize a página.", "error");
          return;
        }
        const data = (await bootstrap.json()) as { data?: { clientes?: Cliente[] } };
        setClientes(data?.data?.clientes ?? []);
        showToast(isNew ? "Cliente criado com sucesso." : "Cliente atualizado com sucesso.", "success");
      } catch {
        setClientes(snapshotBefore);
        showToast("Falha de conexão ao salvar o cliente.", "error");
      }
    })();
    setFormSheetOpen(false);
    setSelectedCliente(null);
  };

  const handleConfirmExcluir = () => {
    if (!clienteToDelete) return;
    const id = clienteToDelete.id;
    setClientes((prev) => prev.filter((c) => c.id !== clienteToDelete.id));
    setClienteToDelete(null);
    void (async () => {
      const snapshotBefore = clientes;
      try {
        const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!res.ok) {
          setClientes(snapshotBefore);
          showToast(json.error?.message ?? "Não foi possível excluir o cliente.", "error");
          return;
        }
        const bootstrap = await fetch("/api/clientes/bootstrap", { cache: "no-store" });
        if (!bootstrap.ok) {
          setClientes(snapshotBefore);
          showToast("Cliente excluído, mas não foi possível recarregar a lista. Atualize a página.", "error");
          return;
        }
        const data = (await bootstrap.json()) as { data?: { clientes?: Cliente[] } };
        setClientes(data?.data?.clientes ?? []);
        showToast("Cliente excluído com sucesso.", "success");
      } catch {
        setClientes(snapshotBefore);
        showToast("Falha de conexão ao excluir cliente.", "error");
      }
    })();
  };

  return (
    <section className="w-full min-w-0 space-y-6">
      {/* Busca + status à esquerda; “Mostrar inativos” à direita — mesma linha no desktop */}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-end sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Busca por nome, CNPJ ou contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              aria-label="Buscar por nome, CNPJ ou contato"
            />
          </div>
          <div className="flex min-w-0 shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="filter-status" className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value || "") as "" | ClienteStatus)}
              className="min-w-[10rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 self-start text-sm text-slate-700 dark:text-slate-300 sm:self-center sm:pl-2">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#6D28D9] focus:ring-[#6D28D9]"
          />
          Mostrar inativos
        </label>
      </div>

      <ClientesTable
        clientes={filteredClientes}
        onVerDetalhes={(c) => {
          setSelectedCliente(c);
          setFormSheetOpen(true);
        }}
        onExcluir={(c) => setClienteToDelete(c)}
      />

      <ClienteFormSheet
        open={formSheetOpen}
        onClose={() => {
          setFormSheetOpen(false);
          setSelectedCliente(null);
        }}
        initialCliente={selectedCliente}
        onSave={handleSaveCliente}
      />

      <AlertDialog
        open={!!clienteToDelete}
        onClose={() => setClienteToDelete(null)}
        onConfirm={handleConfirmExcluir}
        title="Excluir Cliente?"
        description={
          clienteToDelete ? (
            <>
              <strong className="text-slate-900 dark:text-slate-100">Esta ação é irreversível.</strong> O cliente{" "}
              <strong className="text-slate-900 dark:text-slate-100">{clienteToDelete.empresa}</strong> e todos os seus
              contatos serão excluídos permanentemente, incluindo o vínculo no histórico do funil de vendas.
            </>
          ) : (
            ""
          )
        }
        cancelLabel="Cancelar"
        confirmLabel="Sim, excluir permanentemente"
        destructive
      />
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
