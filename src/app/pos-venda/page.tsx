"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { RotateCcw, Save, Search, X } from "lucide-react";
import { AcoesPrioritariasCard } from "@/components/pos-venda/acoes-prioritarias-card";
import { HealthScoreGlobal } from "@/components/pos-venda/health-score-global";
import { HealthDashboard } from "@/components/pos-venda/health-dashboard";
import { CommandCenterHome } from "@/components/pos-venda/command-center-home";
import { ReguaList } from "@/components/pos-venda/regua-list";
import { PlaybookDrawer } from "@/components/pos-venda/playbook-drawer";
import { AgendarTarefaForm } from "@/components/pos-venda/agendar-tarefa-form";
import { DrawerSheet } from "@/components/comercial/drawer-sheet";
import { usePageHeader } from "@/contexts/page-header-context";
import { useResourcePageGuard, useResourceRbac } from "@/hooks/use-rbac-resource";

const POSVENDA_RESOURCE = "posvenda.tarefas";
import {
  TIPO_TAREFA_LABELS,
} from "@/lib/pos-venda/constants";
import type { ClienteHealth, EventoHistorico, TarefaRegua } from "@/lib/pos-venda/types";
import type { Cliente } from "@/lib/clientes/types";
import { emitAlertsUpdated } from "@/lib/alerts/live-sync";
import {
  formInputClass,
  formLabelClass,
  formModalCancelButtonClass,
  formNativeSelectClass,
  formTextareaClass,
} from "@/components/ui/field-patterns";

function generateId(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildAlertPlaybookTask(alerta: { id: string; titulo: string; descricao: string; data?: string }): TarefaRegua {
  const baseDate = (alerta.data ?? new Date().toISOString()).slice(0, 10);
  const text = `${alerta.titulo} ${alerta.descricao}`.toLowerCase();
  let categoria: TarefaRegua["categoria"] = "relacionamento";
  let objetivo = alerta.descricao;
  let script = "Entrar em contato com o cliente hoje, confirmar expectativas e registrar próximos passos no histórico.";
  let tipo: TarefaRegua["tipo"] = "outro";
  const motivoCritico = `${alerta.titulo} - ${alerta.descricao}`;
  let prioridadeCritica = 9;

  if (text.includes("etapa 1") || text.includes("onboarding") || text.includes("aceito")) {
    categoria = "onboarding";
    tipo = "boas_vindas";
    prioridadeCritica = 10;
    objetivo = "Iniciar a Etapa 1 imediatamente para gerar confiança e acelerar o primeiro valor percebido.";
    script =
      "Olá, [Nome]! Boas-vindas. Vamos iniciar sua Etapa 1 agora. Vou te guiar pelo checklist inicial e já deixo os próximos marcos combinados.";
  } else if (text.includes("risco") || text.includes("atras")) {
    categoria = "alerta_risco";
    tipo = "feedback";
    prioridadeCritica = 10;
    objetivo = "Recuperar engajamento, tratar impeditivos e reduzir risco de cancelamento.";
    script =
      "Olá, [Nome], percebi alguns sinais de atenção no acompanhamento. Quero te ajudar a resolver isso hoje. Podemos alinhar os pontos críticos e um plano rápido de ação?";
  } else if (text.includes("etapa 2") || text.includes("relacionamento")) {
    categoria = "relacionamento";
    tipo = "checkup_30";
    prioridadeCritica = 8;
    objetivo = "Iniciar relacionamento contínuo com cadência e previsibilidade.";
    script =
      "Olá, [Nome]! Concluímos a etapa inicial e agora seguimos para o acompanhamento contínuo. Vamos definir os objetivos dos próximos 30 dias?";
  }

  return {
    id: `alert-${alerta.id}`,
    tipo,
    titulo: alerta.titulo,
    clienteId: "alerta",
    clienteNome: "Pós-venda",
    dataAgendada: baseDate,
    status: "pendente",
    categoria,
    prioridadeCritica,
    motivoCritico,
    objetivo,
    scriptSugerido: script,
  };
}

export default function PosVendaPage() {
  const { setPrimaryAction } = usePageHeader();
  const podeVer = useResourcePageGuard(POSVENDA_RESOURCE);
  const rbac = useResourceRbac(POSVENDA_RESOURCE);
  const podeCriarAgendamento = rbac.podeCriar;
  const podeEditarTarefa = rbac.podeEditar;
  const podeExcluirTarefa = rbac.podeExcluir;
  const [tarefas, setTarefas] = useState<TarefaRegua[]>([]);
  const [, setEventos] = useState<EventoHistorico[]>([]);
  const [clienteHealth, setClienteHealth] = useState<ClienteHealth[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lixeira, setLixeira] = useState<TarefaRegua[]>([]);
  const [drawerAgendarOpen, setDrawerAgendarOpen] = useState(false);
  const [playbookTarefa, setPlaybookTarefa] = useState<TarefaRegua | null>(null);
  const [drawerPlaybookOpen, setDrawerPlaybookOpen] = useState(false);
  const [alertTasks, setAlertTasks] = useState<TarefaRegua[]>([]);
  const [lixeiraOpen, setLixeiraOpen] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [restaurarOpen, setRestaurarOpen] = useState(false);
  const [restaurarItem, setRestaurarItem] = useState<TarefaRegua | null>(null);
  const [motivoRestauro, setMotivoRestauro] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const [janela, setJanela] = useState<"hoje" | "7d" | "30d" | "60d">("hoje");
  const [lixeiraBusca, setLixeiraBusca] = useState("");
  const [lixeiraDe, setLixeiraDe] = useState("");
  const [lixeiraAte, setLixeiraAte] = useState("");
  const [lixeiraPeriodo, setLixeiraPeriodo] = useState<"todos" | "7" | "30" | "60">("todos");
  const prioridadesRef = useRef<HTMLDivElement | null>(null);
  const reguaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!podeCriarAgendamento) {
      setPrimaryAction(null);
      return;
    }
    setPrimaryAction({
      label: "Novo Agendamento",
      onClick: () => setDrawerAgendarOpen(true),
      showPlusIcon: true,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, podeCriarAgendamento]);

  useEffect(() => {
    let active = true;

    const loadBootstrap = async () => {
      try {
        const res = await fetch("/api/pos-venda/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: {
            tarefas?: TarefaRegua[];
            lixeira?: TarefaRegua[];
            eventos?: EventoHistorico[];
            clienteHealth?: ClienteHealth[];
            clientes?: Cliente[];
          };
        };
        if (!active) return;
        setTarefas(data?.data?.tarefas ?? []);
        setLixeira(data?.data?.lixeira ?? []);
        setEventos(data?.data?.eventos ?? []);
        setClienteHealth(data?.data?.clienteHealth ?? []);
        setClientes(data?.data?.clientes ?? []);
      } catch {
        // no-op
      }
    };

    void loadBootstrap();
    const timer = window.setInterval(() => void loadBootstrap(), 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPosVendaAlerts = async () => {
      try {
        const res = await fetch("/api/alertas/bootstrap", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          data?: {
            alertas?: Array<{ id: string; titulo: string; descricao: string; lida: boolean; modulo: string; data?: string }>;
          };
        };
        if (!active) return;
        const rows = (payload?.data?.alertas ?? []).filter((a) => !a.lida && a.modulo === "posVenda");
        const mapped: TarefaRegua[] = rows.map((a) => buildAlertPlaybookTask(a));
        setAlertTasks(mapped);
      } catch {
        // noop
      }
    };
    void loadPosVendaAlerts();
    const timer = window.setInterval(() => void loadPosVendaAlerts(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const abrirPlaybook = (tarefa: TarefaRegua) => {
    setPlaybookTarefa(tarefa);
    setDrawerPlaybookOpen(true);
  };

  const handleRegistrarResultado = (tarefa: TarefaRegua, descricaoResultado: string) => {
    if (!podeEditarTarefa && !tarefa.id.startsWith("alert-")) return;
    if (tarefa.id.startsWith("alert-")) {
      const alertaId = tarefa.id.replace("alert-", "");
      setAlertTasks((prev) => prev.filter((t) => t.id !== tarefa.id));
      void fetch(`/api/alertas/${alertaId}/read`, { method: "PATCH" }).finally(() => emitAlertsUpdated());
      setEventos((prev) => [
        ...prev,
        {
          id: `ev-${Date.now()}`,
          clienteId: "alerta",
          tipo: "alerta",
          titulo: `Ação concluída: ${tarefa.titulo}`,
          descricao: `${tarefa.objetivo ? `${tarefa.objetivo}\n\n` : ""}Descrição do resultado: ${descricaoResultado}`,
          data: new Date().toISOString(),
          categoria: tarefa.categoria,
        },
      ]);
      setDrawerPlaybookOpen(false);
      setPlaybookTarefa(null);
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const atualizada: TarefaRegua = { ...tarefa, status: "concluida", dataConclusao: hoje };
    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefa.id
          ? atualizada
          : t
      )
    );
    void fetch(`/api/pos-venda/tarefas/${tarefa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarefa: atualizada,
        eventoTitulo: `${tarefa.titulo} concluída — ${descricaoResultado}`,
      }),
    });
    const proximaTipo = tarefa.proximaEtapaTipo;
    if (proximaTipo && tarefa.intervaloRecorrenciaDias) {
      const proximaData = addDays(hoje, tarefa.intervaloRecorrenciaDias);
      const nova: TarefaRegua = {
        id: generateId(),
        tipo: proximaTipo,
        titulo: TIPO_TAREFA_LABELS[proximaTipo],
        clienteId: tarefa.clienteId,
        clienteNome: tarefa.clienteNome,
        dataAgendada: proximaData,
        status: "pendente",
        categoria: tarefa.categoria === "onboarding" ? "relacionamento" : tarefa.categoria,
        intervaloRecorrenciaDias: tarefa.intervaloRecorrenciaDias,
        proximaEtapaTipo: proximaTipo,
      };
      setTarefas((prev) => [...prev, nova]);
      void fetch("/api/pos-venda/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarefa: nova }),
      });
    }
    setEventos((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        clienteId: tarefa.clienteId,
        tipo: "tarefa_concluida" as const,
        titulo: `${tarefa.titulo} concluída — ${descricaoResultado}`,
        data: new Date().toISOString(),
        tarefaId: tarefa.id,
        categoria: tarefa.categoria,
      },
    ]);
    setDrawerPlaybookOpen(false);
    setPlaybookTarefa(null);
  };

  const handleAdiar = (tarefa: TarefaRegua, motivoAdiar: string, dias: number) => {
    if (!podeEditarTarefa) return;
    const base = new Date().toISOString().slice(0, 10);
    const reagendada = addDays(base, Math.max(1, Math.floor(dias)));
    // Reagendamento precisa continuar "selecionável/aberto" na régua (permitimos clique em "adiada").
    const atualizada: TarefaRegua = { ...tarefa, dataAgendada: reagendada, status: "adiada" };
    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefa.id ? atualizada : t
      )
    );
    void fetch(`/api/pos-venda/tarefas/${tarefa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarefa: atualizada,
        eventoTitulo: `${tarefa.titulo} adiada em ${Math.max(1, Math.floor(dias))} dia(s) — Motivo: ${motivoAdiar}`,
      }),
    });
    const eventoTitulo = `${tarefa.titulo} adiada em ${Math.max(1, Math.floor(dias))} dia(s) — Motivo: ${motivoAdiar}`;
    setEventos((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        clienteId: tarefa.clienteId,
        tipo: "tarefa_concluida" as const,
        titulo: eventoTitulo,
        data: new Date().toISOString(),
        tarefaId: tarefa.id,
        categoria: tarefa.categoria,
      },
    ]);
    setDrawerPlaybookOpen(false);
    setPlaybookTarefa(null);
  };

  const handleAgendar = (
    nova: Omit<TarefaRegua, "id"> & { intervaloRecorrenciaDias?: number }
  ) => {
    if (!podeCriarAgendamento) return;
    const { intervaloRecorrenciaDias, ...rest } = nova;
    const created: TarefaRegua = {
      ...rest,
      id: generateId(),
      intervaloRecorrenciaDias,
    };
    setTarefas((prev) => [
      ...prev,
      created,
    ]);
    void fetch("/api/pos-venda/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefa: created }),
    });
    setDrawerAgendarOpen(false);
  };

  const handleEnviarParaLixeira = async (motivoRemocao: string) => {
    if (!podeExcluirTarefa) return;
    if (!playbookTarefa) {
      window.alert("Não foi possível enviar para a lixeira: item não selecionado.");
      return;
    }
    if (!motivoRemocao.trim()) {
      window.alert("Informe o motivo para enviar o item à lixeira.");
      return;
    }
    setRemovendo(true);
    try {
      const res = await fetch(`/api/pos-venda/tarefas/${playbookTarefa.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoRemocao.trim() }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          // Item local ainda não persistido no banco: mantém comportamento de lixeira no front.
          setTarefas((prev) => prev.filter((t) => t.id !== playbookTarefa.id));
          setLixeira((prev) => [
            ...prev,
            { ...playbookTarefa, removidaEm: new Date().toISOString(), removidaMotivo: motivoRemocao.trim() },
          ]);
          setDrawerPlaybookOpen(false);
          setPlaybookTarefa(null);
          return;
        }
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        const message = payload?.error?.message || "Não foi possível enviar o item para a lixeira. Tente novamente.";
        window.alert(message);
        return;
      }
      setTarefas((prev) => prev.filter((t) => t.id !== playbookTarefa.id));
      setLixeira((prev) => [
        ...prev,
        { ...playbookTarefa, removidaEm: new Date().toISOString(), removidaMotivo: motivoRemocao.trim() },
      ]);
      setEventos((prev) => [
        ...prev,
        {
          id: `ev-${Date.now()}`,
          clienteId: playbookTarefa.clienteId,
          tipo: "alerta",
          titulo: `Item movido para lixeira: ${playbookTarefa.titulo}`,
          descricao: motivoRemocao.trim(),
          data: new Date().toISOString(),
          categoria: playbookTarefa.categoria,
        },
      ]);
      setDrawerPlaybookOpen(false);
      setPlaybookTarefa(null);
    } catch {
      window.alert("Falha de rede ao enviar para a lixeira. Verifique o servidor e tente novamente.");
    } finally {
      setRemovendo(false);
    }
  };

  const abrirRestauro = (item: TarefaRegua) => {
    setRestaurarItem(item);
    setMotivoRestauro("");
    setRestaurarOpen(true);
  };

  const handleRestaurarDaLixeira = async () => {
    if (!restaurarItem || !motivoRestauro.trim()) return;
    setRestaurando(true);
    try {
      const res = await fetch(`/api/pos-venda/tarefas/${restaurarItem.id}/restore`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoRestauro.trim() }),
      });
      if (!res.ok) return;
      setLixeira((prev) => prev.filter((i) => i.id !== restaurarItem.id));
      setTarefas((prev) => [...prev, { ...restaurarItem, removidaEm: undefined, removidaMotivo: undefined, removidaPor: undefined, status: "pendente" }]);
      setEventos((prev) => [
        ...prev,
        {
          id: `ev-${Date.now()}`,
          clienteId: restaurarItem.clienteId,
          tipo: "alerta",
          titulo: `Item restaurado da lixeira: ${restaurarItem.titulo}`,
          descricao: motivoRestauro.trim(),
          data: new Date().toISOString(),
          categoria: restaurarItem.categoria,
        },
      ]);
      setRestaurarOpen(false);
      setRestaurarItem(null);
      setMotivoRestauro("");
    } finally {
      setRestaurando(false);
    }
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimJanela = new Date(hoje);
  if (janela === "7d") fimJanela.setDate(fimJanela.getDate() + 7);
  if (janela === "30d") fimJanela.setDate(fimJanela.getDate() + 30);
  if (janela === "60d") fimJanela.setDate(fimJanela.getDate() + 60);
  const tarefasVisao = tarefas.filter((t) => new Date(`${t.dataAgendada}T00:00:00`).getTime() <= fimJanela.getTime());
  const alertTasksVisao = alertTasks.filter((t) => new Date(`${t.dataAgendada}T00:00:00`).getTime() <= fimJanela.getTime());
  // A Régua e as Ações Prioritárias precisam mostrar também atrasos (datas < hoje).
  const tarefasRegua = tarefas;
  const alertTasksFuturas = alertTasks;
  const lixeiraFiltrada = useMemo(() => {
    const term = lixeiraBusca.trim().toLowerCase();
    const deTs = lixeiraDe ? new Date(`${lixeiraDe}T00:00:00`).getTime() : null;
    const ateTs = lixeiraAte ? new Date(`${lixeiraAte}T23:59:59`).getTime() : null;
    const limitePeriodo = (() => {
      if (lixeiraPeriodo === "todos") return null;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - Number(lixeiraPeriodo));
      return d.getTime();
    })();
    return [...lixeira]
      .sort((a, b) => {
        const da = a.removidaEm ? new Date(a.removidaEm).getTime() : 0;
        const db = b.removidaEm ? new Date(b.removidaEm).getTime() : 0;
        return db - da;
      })
      .filter((item) => {
        const txt = `${item.titulo} ${item.clienteNome} ${item.removidaMotivo || ""}`.toLowerCase();
        if (term && !txt.includes(term)) return false;
        const ts = item.removidaEm ? new Date(item.removidaEm).getTime() : 0;
        if (deTs && ts < deTs) return false;
        if (ateTs && ts > ateTs) return false;
        if (limitePeriodo && ts < limitePeriodo) return false;
        return true;
      });
  }, [lixeira, lixeiraBusca, lixeiraDe, lixeiraAte, lixeiraPeriodo]);

  if (!podeVer) return null;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CommandCenterHome
            tarefas={tarefasVisao}
            alertTasks={alertTasksVisao}
            clienteHealth={clienteHealth}
            onIrParaPrioridade={() => prioridadesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            onIrParaRegua={() => reguaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            podeVerLixeira={podeExcluirTarefa}
            onAbrirLixeira={() => setLixeiraOpen(true)}
            janela={janela}
            onChangeJanela={setJanela}
          />
        </div>
        <div>
          <HealthScoreGlobal clientes={clienteHealth} />
        </div>
      </div>

      <div ref={prioridadesRef}>
        <AcoesPrioritariasCard tarefas={[...alertTasksFuturas, ...tarefasRegua]} onSelecionarTarefa={abrirPlaybook} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div ref={reguaRef}>
          <ReguaList
            tarefas={tarefasRegua}
            onSelecionarTarefa={abrirPlaybook}
            pageSize={6}
            somentePendentes={false}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="h-full">
          <HealthDashboard clientes={clienteHealth} />
        </div>
      </div>

      {/* Drawer: Playbook (Objetivo, Script, Registrar/Adiar) */}
      <DrawerSheet
        open={drawerPlaybookOpen}
        onClose={() => {
          setDrawerPlaybookOpen(false);
          setPlaybookTarefa(null);
        }}
        title={playbookTarefa ? `${playbookTarefa.titulo} — ${playbookTarefa.clienteNome}` : "Detalhes da ação"}
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PlaybookDrawer
            tarefa={playbookTarefa}
            onRegistrarResultado={handleRegistrarResultado}
            onAdiar={handleAdiar}
            podeEnviarParaLixeira={
              podeExcluirTarefa && !!playbookTarefa && !playbookTarefa.id.startsWith("alert-")
            }
            enviandoLixeira={removendo}
            onEnviarParaLixeira={(motivo) => void handleEnviarParaLixeira(motivo)}
            onFechar={() => {
              setDrawerPlaybookOpen(false);
              setPlaybookTarefa(null);
            }}
          />
        </div>
      </DrawerSheet>

      {/* Drawer: Agendar tarefa (régua recorrente opcional) */}
      <DrawerSheet
        open={drawerAgendarOpen}
        onClose={() => setDrawerAgendarOpen(false)}
        title="Novo agendamento"
        mobileContentPaddingClassName="px-0"
        desktopContentPaddingClassName="px-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgendarTarefaForm
            clientes={clientes}
            onSave={handleAgendar}
            onCancel={() => setDrawerAgendarOpen(false)}
          />
        </div>
      </DrawerSheet>

      <DrawerSheet open={lixeiraOpen} onClose={() => setLixeiraOpen(false)} title="Lixeira do Pós-venda" maxWidth="sm:max-w-3xl">
        <div className="space-y-3 overflow-y-auto overscroll-contain p-4 lg:p-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={lixeiraBusca}
                onChange={(e) => setLixeiraBusca(e.target.value)}
                placeholder="Buscar na lixeira"
                className={`${formInputClass} pl-9`}
              />
            </div>
            <input
              type="date"
              value={lixeiraDe}
              onChange={(e) => setLixeiraDe(e.target.value)}
              className={formInputClass}
            />
            <input
              type="date"
              value={lixeiraAte}
              onChange={(e) => setLixeiraAte(e.target.value)}
              className={formInputClass}
            />
            <select
              value={lixeiraPeriodo}
              onChange={(e) => setLixeiraPeriodo(e.target.value as "todos" | "7" | "30" | "60")}
              className={formNativeSelectClass}
            >
              <option value="todos">Período: Todos</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias</option>
            </select>
          </div>
          {lixeiraFiltrada.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item na lixeira.</p>
          )}
          {lixeiraFiltrada.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.titulo}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.clienteNome}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Motivo: {item.removidaMotivo || "Não informado"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Removido em: {item.removidaEm ? new Date(item.removidaEm).toLocaleString("pt-BR") : "-"}
              </p>
              {podeExcluirTarefa && (
                <button
                  type="button"
                  onClick={() => abrirRestauro(item)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Restaurar
                </button>
              )}
            </div>
          ))}
        </div>
      </DrawerSheet>

      <DrawerSheet open={restaurarOpen} onClose={() => setRestaurarOpen(false)} title="Restaurar item da lixeira" maxWidth="sm:max-w-xl">
        <div className="space-y-4 overflow-y-auto overscroll-contain p-4 lg:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Informe o motivo do retorno para manter rastreabilidade completa.
          </p>
          <div>
            <label htmlFor="motivo-restauro-pos-venda" className={formLabelClass}>
              Motivo da restauração
            </label>
            <textarea
              id="motivo-restauro-pos-venda"
              value={motivoRestauro}
              onChange={(e) => setMotivoRestauro(e.target.value)}
              rows={4}
              className={`${formTextareaClass} mt-1`}
              placeholder="Descreva por que este item está voltando à régua."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRestaurarOpen(false)} className={formModalCancelButtonClass}>
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancelar
              </span>
            </button>
            <button
              type="button"
              disabled={restaurando || !motivoRestauro.trim()}
              onClick={() => void handleRestaurarDaLixeira()}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                {restaurando ? "Restaurando..." : "Confirmar restauração"}
              </span>
            </button>
          </div>
        </div>
      </DrawerSheet>
    </section>
  );
}
