# Backlog de Produto e Evolução

Objetivo: centralizar pendências, melhorias e novidades para evitar perda de contexto.

## Como usar

- Atualizar este arquivo ao final de cada ciclo de trabalho.
- Cada item deve ter: prioridade, status, impacto e critério de aceite.
- Status permitidos: `pendente`, `em_analise`, `planejado`, `em_execucao`, `concluido`.

## Priorização atual (visão executiva) — atualizado 2026-05-18

**Decisão de produto (alinhamento com gestão):**

| Ordem | Foco | Item principal |
|-------|------|----------------|
| **1** | **Segurança e governança de acesso** | **BL-018** — ✅ MVP concluído; evoluções BL-021 / BL-022 |
| **2** | Estabilidade e confiança | BL-006, BL-007, BL-008 (lint, observabilidade, rotação de credenciais) |
| **3** | Documentos e comunicação | BL-001, BL-009 (fechar), BL-002–004 |
| **4** | Gestão comercial ampliada | **BL-019** — módulo Marketing (planejamento → MVP) |
| **5** | Relatórios e decisão | BL-011–014, BL-013 (financeiro gerencial) |
| **6** | UX plataforma | BL-016 (sidebar) |
| **7** | IA assistente completa | **BL-020** — leitura + ação no sistema (faseada; após RBAC) |
| **8** | GovRadar / prospecção pública | **BL-017** — importante, **não é prioridade agora** |

**Regra de execução:** nenhuma feature de IA com escrita automática em produção sem respeitar o RBAC do BL-018 (MVP validado em API e UI, maio/2026).

### Próximo ciclo — o que fazer agora? (escolha de produto)

| # | Item | Status | Prioridade | Por que considerar agora |
|---|------|--------|------------|---------------------------|
| A | **BL-006** — lint/hooks | pendente | P2 técnico | Base saudável antes de features grandes |
| B | **BL-007** — observabilidade BD | pendente | P2 técnico | Menos surpresa em produção (Railway) |
| C | **BL-001 / BL-009** — documentos | em_analise / em_execucao | P0/P1 | Impacto direto no dia a dia (timbrado, variáveis relatório) |
| D | **BL-019** — Marketing | em_analise | P1 negócio | Origem de leads, campanhas (descoberta antes de codar) |
| E | **BL-011–014** — relatórios avançados | planejado | P1 | Decisão e BI sobre o que já existe |
| F | **BL-016** — sidebar sem rolagem | planejado | P2 UX | Melhoria rápida de navegação |
| G | **BL-020** — IA assistente | planejado | P1 | Só após RBAC estável ✅ — pode iniciar fase leitura |
| H | **BL-021** — Calendário + Arquivos | planejado | P2 | Produto ainda mock; RBAC quando MVP existir |
| I | **BL-022** — escopo equipe/gerente | planejado | P2 | Depende cadastro de equipe no RH |
| — | **BL-018** — RBAC | **concluido** | — | Manutenção apenas; evoluções em BL-021/022 |
| — | **BL-017** — GovRadar | planejado | adiado | Importante, não é foco imediato |

**Sugestão de sequência (se não houver outra prioridade de gestão):** (1) publicar RBAC no GitHub + backup ✅ → (2) BL-001/009 ou BL-019 descoberta → (3) BL-006/007 em paralelo técnico.

---

## Concluído recentemente (produção — registrar para não reabrir)

- [2026-05] Módulo **Comissões** (core, vínculo a lançamentos, painéis RH/Financeiro).
- [2026-05] **Venda direta** no Financeiro (`registroLead`, fluxo e bloqueio no Comercial).
- [2026-05] **Sincronização de alertas** com resolução de pendências (badges sidebar, reconciliação).
- [2026-05] Correções Financeiro: dedupe de lançamentos, aba Comissões na edição, urgência.
- [2026-05] Release em produção (Railway) validada pelo time.
- [2026-05-18] **RBAC granular (BL-018) — MVP concluído** — matriz, proxy, APIs, escopo «Ver de todos», relatórios, Central com KPIs filtrados (Suporte/Tarefas/Clientes). Validação manual OK. Resíduos: Calendário/Arquivos → BL-021; escopo equipe → BL-022.
- [2026-05-22] **Backup completo** verificado em `backups/archive/2026-05-22T17-51-01` (BD + uploads + Prisma + `.env`). Próximo passo: publicar RBAC no GitHub.

---

## Itens pendentes

## BL-001 - Construtor de Documentos: papel timbrado padrão da empresa
- `status`: `em_analise`
- `prioridade`: `P0`
- `impacto`: Alto (percepção de qualidade e padronização institucional)
- `escopo`:
  - Permitir identidade visual global com fundo padrão para documento.
  - Definir abordagem: `fundo (watermark/papel timbrado)` vs `cabecalho+rodape fixos` (ou híbrido).
  - Garantir render consistente em preview HTML e PDF.
- `critério de aceite`:
  - Documento gerado com layout institucional consistente em todas as páginas.
  - Cabeçalho/rodapé/fundo preservados no PDF e no HTML de visualização.
  - Configuração global editável em Configurações > Construtor de Documentos.

## BL-002 - Construtor de Documentos: presets por tipo de documento
- `status`: `pendente`
- `prioridade`: `P1`
- `impacto`: Alto (agilidade operacional)
- `escopo`:
  - Preset para `proposta`, `oficio`, `prestacao_contas`, `relatorio`.
  - Aplicar assunto/corpo/cabecalho/rodape base ao criar novo modelo.
- `critério de aceite`:
  - Novo modelo nasce com conteúdo padrão por tipo, sem retrabalho manual.

## BL-003 - Variáveis de template: cobertura e governança
- `status`: `pendente`
- `prioridade`: `P1`
- `impacto`: Médio/Alto
- `escopo`:
  - Mapear variáveis faltantes por módulo (comercial/contratos/financeiro).
  - Exibir documentação rápida de variáveis no construtor.
- `critério de aceite`:
  - Usuário entende e utiliza variáveis sem tentativa e erro.

## BL-004 - Uso de documentos nos módulos além de Comercial
- `status`: `em_analise`
- `prioridade`: `P1`
- `impacto`: Alto
- `escopo`:
  - Definir expansão para Contratos, Financeiro e Helpdesk (quando aplicável).
  - Reaproveitar pipeline de preview/geração/PDF/envio já consolidado.
- `critério de aceite`:
  - Ao menos 1 fluxo novo de geração documental fora do Comercial em produção.

## BL-005 - Catálogo de modelos com versionamento e comparação
- `status`: `pendente`
- `prioridade`: `P2`
- `impacto`: Médio
- `escopo`:
  - Visualizar histórico de versões e comparar mudanças entre versões.
- `critério de aceite`:
  - Auditoria funcional de conteúdo por versão disponível para time gestor.

## BL-006 - Qualidade técnica: erros críticos de lint/hooks
- `status`: `pendente`
- `prioridade`: `P1`
- `impacto`: Alto (prevenção de regressões)
- `escopo`:
  - Corrigir erros críticos de `react-hooks/set-state-in-effect`.
  - Reduzir warnings com foco em arquivos ativos do produto.
- `critério de aceite`:
  - Sem erros críticos de lint nos módulos priorizados.

## BL-007 - Observabilidade de erros de banco e migração
- `status`: `pendente`
- `prioridade`: `P1`
- `impacto`: Alto (resposta rápida a incidentes)
- `escopo`:
  - Log interno com causa técnica detalhada (`tabela/coluna`) em erros Prisma.
  - Mensagem amigável para usuário final, sem vazar detalhes sensíveis.
- `critério de aceite`:
  - Time identifica causa raiz em minutos por logs.

## BL-008 - Segurança operacional: rotação periódica de credenciais
- `status`: `pendente`
- `prioridade`: `P1`
- `impacto`: Alto
- `escopo`:
  - Política trimestral de rotação.
  - Checklist de execução sem downtime.
- `critério de aceite`:
  - Processo repetível e documentado, sem indisponibilidade.

## BL-009 - Relatórios: variáveis multi-módulo no Construtor (UX guiada)
- `status`: `em_execucao`
- `prioridade`: `P1`
- `impacto`: Alto (agilidade na montagem de templates por área)
- `escopo`:
  - Melhorar a experiência de seleção de variáveis por módulos de origem (Operacional, Financeiro, Comercial, Prestação de Contas, etc.).
  - Incluir busca por variável, exemplos de uso e validação visual de tokens no editor.
- `critério de aceite`:
  - Usuário encontra e insere variáveis de outros módulos sem tentativa e erro.
  - Preview indica claramente variáveis não reconhecidas.

### Progresso recente
- Catálogo separado por módulos únicos de relatórios (Prestação de Contas, Operacional, Financeiro e Comercial), sem mistura em grupo único.
- Busca rápida de variáveis adicionada no Construtor para reduzir rolagem em documentos extensos.
- Renderização de relatórios padronizada com fallback de variáveis completas, evitando tokens crus no preview quando o modelo usa placeholders de módulos diferentes.

## BL-010 - Saúde da Empresa v2: score por responsável e alertas
- `status`: `planejado`
- `prioridade`: `P2`
- `impacto`: Alto (visão executiva e ação preventiva)
- `escopo`:
  - Score por colaborador/consultor/parceiro.
  - Alertas automáticos de risco (cliente e operação).
  - Metas por área com semáforo (verde/amarelo/vermelho).
- `critério de aceite`:
  - Dashboard exibe score por responsável e lista priorizada de alertas.
  - Metas e semáforos visíveis por área com atualização mensal.

## BL-011 - Relatórios Operacionais avançados
- `status`: `planejado`
- `prioridade`: `P1`
- `impacto`: Alto (controle de execução e qualidade)
- `escopo`:
  - Produtividade por responsável (tarefas/tickets concluídos, atrasos e tempo médio).
  - SLA por cliente e por categoria com tendência mensal.
  - Backlog por prioridade e tempo em aberto.
- `critério de aceite`:
  - Relatórios disponíveis com filtros padrão (cliente, período, situação) e ações de visualizar/exportar/enviar.

## BL-012 - Prestação de Contas executiva mensal
- `status`: `planejado`
- `prioridade`: `P1`
- `impacto`: Alto (comunicação com cliente e transparência)
- `escopo`:
  - Versão executiva com resumo mensal e versão detalhada por entregável.
  - Blocos prontos para envio recorrente por cliente.
- `critério de aceite`:
  - Documento pronto para cliente com visão executiva + detalhamento operacional completo.

## BL-013 - Financeiro gerencial e previsão de caixa
- `status`: `planejado`
- `prioridade`: `P1`
- `impacto`: Alto (decisão financeira)
- `escopo`:
  - DRE gerencial simplificada por mês e acumulado.
  - Inadimplência avançada (faixas de atraso e concentração).
  - Previsão de caixa 30/60/90 dias.
- `critério de aceite`:
  - Relatórios financeiros com gráficos, KPIs e projeções acionáveis.

## BL-014 - Comercial de performance e conversão
- `status`: `planejado`
- `prioridade`: `P1`
- `impacto`: Alto (crescimento e previsibilidade)
- `escopo`:
  - Funil por origem/canal com taxa de conversão e ticket médio.
  - Performance de propostas (ganhas/perdidas/motivos/tempo de fechamento).
- `critério de aceite`:
  - Gestão comercial com visibilidade por canal, etapa e resultado.

## BL-015 - Suporte e Saúde da Empresa (radar de risco)
- `status`: `planejado`
- `prioridade`: `P2`
- `impacto`: Médio/Alto
- `escopo`:
  - Qualidade de atendimento (primeira resposta, resolução, reabertura, backlog).
  - Radar de risco por cliente com gatilhos automáticos (SLA + financeiro + comercial).
- `critério de aceite`:
  - Painel com alertas priorizados e score consolidado por cliente.

## BL-016 - Navegação sidebar sem rolagem (UX)
- `status`: `planejado`
- `prioridade`: `P1`
- `impacto`: Alto (navegação diária e usabilidade em telas menores)
- `escopo`:
  - Reorganizar sidebar em modelo híbrido: itens principais fixos + item "Mais".
  - Adicionar busca de menus (atalho rápido) para abrir páginas sem rolagem.
  - Criar seção de favoritos por usuário (3-5 atalhos).
  - Melhorar comportamento responsivo (sidebar recolhida em telas menores).
- `critério de aceite`:
  - Sidebar principal sem barra de rolagem em resoluções menores.
  - Acesso rápido às páginas secundárias via "Mais" e busca.
  - Navegação mais rápida e consistente entre módulos.

## BL-017 - Módulo Extrator Inteligente (codinome GovRadar)
- `status`: `planejado`
- `prioridade`: `P2` (importante para o negócio; **adiado** até RBAC + Marketing/relatórios maduros)
- `impacto`: Muito alto (inteligência comercial e prospecção em entidades públicas)
- `contexto`:
  - Agente para mapear ecossistema municipalista (prefeituras, consórcios, associações/federações de municípios, conselhos municipais/setoriais, entidades paraestatais com estrutura de conselho).
  - Integração no Gestor Desenvolve (CRM/ERP): drill-down territorial, fila de entidades, status de confiança, promoção **manual** a Lead no Comercial (sem lead automático).
- `arquitetura alvo (referência PRD maio/2026)`:
  - UI no app atual (Node/TS/Next).
  - Worker separado: Python + Playwright (headless) para sites oficiais.
  - IA para estruturação (ex.: Gemini Flash / cota gratuita no piloto) com política de confiança baseada em regras + heurísticas (não depender de “% de certeza” da IA).
  - Descoberta: Google Custom Search limitada a `*.gov.br` / `*.leg.br` (cota baixa no free — planejar seeds IBGE e segunda estratégia antes de escala nacional).
  - PostgreSQL (Railway): malha IBGE, entidades, departamentos, contatos, upsert sem histórico infinito (substituir “atual”).
- `status de dados (confiabilidade)`:
  - Pronto/Atualizado, Pendente de revisão (dúvida), Falha/ação manual.
- `fases sugeridas`:
  1. Infra geográfica (IBGE) + tabelas e campos de status.
  2. UI drill-down + filtros por confiança.
  3. Agendamento de jobs (cron / fila) e definição de alvos.
  4. Worker piloto (ex.: Palhoça/SC) validando classificação; depois expandir por microregião/estado/região.
- `riscos e decisões a documentar antes de codar`:
  - “Custo zero” viável no MVP; escala nacional exige orçamento (APIs, worker, quotas).
  - Sites heterogêneos: esperar templates por família de site + fila de exceções, não um único script para 5.570 municípios.
  - Política única de fontes (oficial vs redes sociais) e aspectos legais/éticos (intervalos, robots.txt, uso de dados públicos).
  - Validação de e-mail: sintaxe no free; verificação de caixa é serviço adicional na maioria dos casos.
- `critério de aceite` (MVP fechável):
  - Malha territorial navegável com dados IBGE.
  - Pelo menos um fluxo de extração piloto com os três status e fila revisável.
  - Ação explícita “Promover a Lead” criando registro no Comercial com regras de duplicidade definidas.
  - Limites operacionais (cap diário de jobs/API) e observabilidade (logs por execução/município).

---

## BL-018 - Perfis de acesso: permissões granulares (Ver / Criar / Editar / Excluir) por módulo e escopo
- `status`: `concluido` (MVP em produção — evoluções futuras em BL-021 e BL-022)
- `prioridade`: **`P0` — prioridade máxima do produto**
- `impacto`: Muito alto (segurança, credibilidade, LGPD operacional; **problema atual:** consultor vê dados de outros sem limite)
- `contexto`:
  - Hoje o perfil habilita/desabilita **módulos inteiros**, sem controle fino de ações, subpáginas nem **escopo de dados**.
  - **Meta explícita:** perfil “Consultor” (e similares) enxerga **apenas registros vinculados ao usuário** (leads, contratos, lançamentos, comissões, tarefas, etc.), salvo exceções definidas para gestores.
- `modelo alvo (resumo)`:
  - **Recurso**: hierarquia estável (`configuracoes.comissoes`, `financeiro.lancamentos`, `contratos`…).
  - **Ações**: Ver, Criar, Editar, Excluir (variantes de negócio mapeadas para uma delas).
  - **Escopo** (quando aplicável): ex. `todos` vs `vinculados_a_mim` para contratos ou extratos do consultor.
  - Toda mutação em **API** deve validar permissão; a UI apenas reflete.
- `entregas sugeridas (fases)`:
  1. Catálogo de recursos + matriz por perfil na UI de administração + presets (Admin, Financeiro, Consultor externo).
  2. Camada única de resolução de permissão consumida por rotas `/api` e por layouts/menus.
  3. Piloto em um ou dois módulos (ex.: Configurações + Contratos), depois replicar o padrão.
  4. Migração de perfis existentes com default seguro (menos permissão, ajuste manual onde necessário).
- `critério de aceite` (MVP fechável):
  - Pelo menos um perfil de teste com acesso restrito a subárea de Configurações e bloqueio comprovado em API e ao acessar URL direta.
  - Consultor externo sem acesso a financeiro global e/ou contratos fora do escopo definido.
  - Registro ou log mínimo de negações para suporte.

### Escopo mínimo por módulo (piloto RBAC + escopo)

| Módulo | Escopo consultor (exemplo) |
|--------|----------------------------|
| Comercial | Leads onde é responsável ou na equipe definida |
| Contratos | Contratos do lead/cliente vinculado |
| Financeiro | Lançamentos/comissões ligados ao consultor (sem visão global) |
| Pós-venda / Tarefas | Tarefas atribuídas ou do cliente vinculado |
| Helpdesk | Tickets do cliente vinculado (se aplicável) |
| Configurações | Sem acesso ou só “meu perfil” |

### Onde estamos hoje (diagnóstico — atualizado 2026-05-18)

| Camada | Situação atual | Observação |
|--------|----------------|------------|
| **UI Perfis** | Matriz granular por subárea (`perfil-permission-matrix.tsx`) | Ver / Criar / Editar / Excluir / Ver de todos |
| **Persistência** | `permissoesGranulares` (JSON no perfil) + legado `PerfilPermissao` em paralelo | Migração automática de toggles antigos |
| **Menu / rotas** | `proxy.ts` → `canAccessPageRoute` (granular) | Sem `hasModuleAccess` duplicado |
| **Sidebar / Central** | `resourceId` + `authorize`; KPIs filtrados por escopo | Alinhado às APIs |
| **APIs** | Gates (`rbac-gate`) nos módulos de operação | Escopo vinculados em listas, detalhe e relatórios |
| **Admin** | `isSessionAdmin` / perfil Administrador | Bypass total documentado |

**Conclusão (MVP):** permissões na UI **refletem** bloqueio em API e URL direta nos módulos em produção. Evoluções fora do MVP: **BL-021** (Calendário/Arquivos), **BL-022** (escopo equipe), tela de auditoria de negações RBAC.

### Plano de execução (fases — histórico)

| Fase | Escopo | Estado |
|------|--------|--------|
| 0 | Especificação com gestão | ✅ |
| 1 | Catálogo + `authorize` + matriz UI + migração JSON | ✅ |
| 2 | Comercial + Central | ✅ |
| 3 | Financeiro + Contratos | ✅ |
| 4 | Clientes, Suporte, Pós-venda, Tarefas, RH, Relatórios, Config | ✅ |
| 5 | Escopo equipe + log negações + desligar legado | ➡️ BL-022 / nice-to-have |

### Catálogo de recursos (proposta v1)

```
comercial.leads          → ver | criar | editar | excluir | escopo: todos | vinculados
comercial.relatorios     → ver (subárea comercial)
financeiro.lancamentos   → ver | criar | editar | excluir | dar_baixa | escopo: todos | vinculados
financeiro.comissoes     → ver | editar | escopo: todos | proprias
financeiro.aprovacoes    → ver | aprovar | recusar | escopo: todos
contratos.contratos      → ver | editar | escopo: todos | vinculados
clientes.cadastro        → ver | criar | editar | escopo: todos | vinculados
helpdesk.tickets         → ver | criar | editar | escopo: todos | vinculados
posvenda.tarefas         → ver | editar | escopo: todos | atribuidas
tarefas.internas         → ver | criar | editar | escopo: todos | atribuidas
rh.colaboradores         → ver | criar | editar | escopo: todos (gestão)
configuracoes.*          → sub-recursos já existentes (perfis, usuarios, logs, construtor)
relatorios.*             → ver por área
```

### Decisões fechadas com gestão (2026-05-15)

| # | Tema | Decisão |
|---|------|---------|
| 1 | Comercial — quem vê o lead | **Sim:** responsável **ou** colaborador vinculado ao lead pode **visualizar** (quando escopo = “só vinculados”). |
| 2 | Financeiro — comissões | Perfil Consultor: **apenas comissões próprias**, nunca de outros consultores. (Gestores/equipe: fase futura.) |
| 3 | Clientes | **Ver e editar todos** os clientes; **criar** novos; **nunca excluir** — apenas **inativar** (ação separada de Excluir). |
| 4 | Ordem de entrega | **Módulo a módulo**, etapa por etapa; piloto = **Comercial**. |
| 5 | Matriz por perfil (exceto Admin) | Para **cada módulo/recurso**: marcar **Ver, Criar, Editar, Excluir** independentemente. |
| 6 | Ver conteúdo de outros | Por módulo: checkbox **“Ver conteúdo de outros usuários”** — se desligado, só vinculados; se ligado, tudo daquele módulo (ex.: todos os leads). |
| 7 | Gerente Comercial (futuro) | Ver **toda a equipe** no Comercial, **sem** outros módulos — requer cadastro de equipe (RH); escopo `equipe` na Fase 4+. |
| 8 | Administrador | Continua com **acesso total** (override); não usa matriz restritiva na prática. |

### Modelo de permissão (especificação v1 — sem ambiguidade)

Cada perfil (exceto Administrador) guarda, **por recurso do catálogo**:

| Campo | Significado |
|-------|-------------|
| `ver` | Pode abrir listas/detalhes permitidos pelo escopo |
| `criar` | Pode criar registros novos naquele recurso |
| `editar` | Pode alterar registros existentes (inclui **inativar** cliente quando aplicável) |
| `excluir` | Pode apagar permanentemente (Clientes: **sempre false** no sistema; UI não oferece) |
| `verConteudoDeOutros` | **false** = só registros vinculados ao usuário; **true** = todos os registros **daquele módulo** |

**Escopos de dados (como o sistema filtra quando `verConteudoDeOutros = false`):**

| Módulo | “Só meu / vinculado” |
|--------|----------------------|
| Comercial (leads) | Responsável principal **ou** colaborador no `ownership` do lead |
| Financeiro (comissões) | Sempre **só do próprio usuário/consultor** (regra fixa; checkbox de “outros” não amplia comissões) |
| Financeiro (lançamentos) | Conforme matriz + escopo (Fase 3) |
| Clientes | **Todos** podem ver/editar (decisão #3); escopo “vinculados” **não** se aplica a clientes |
| Contratos | Lead/cliente vinculado ao usuário (quando escopo restrito) |
| Demais | Definido por recurso em cada fase |

**Exemplos validados:**

| Perfil | Comercial | `verConteudoDeOutros` | Resultado |
|--------|-----------|------------------------|-----------|
| Consultor A | Ver+Editar vinculados | ❌ | Só leads onde é responsável ou colaborador |
| Consultor B | Ver+Editar | ✅ | Vê **todos** os leads do Comercial; sem Financeiro |
| Gerente Comercial (futuro) | Ver+Editar equipe | escopo `equipe` | Todos os leads dos consultores da equipe; sem outros módulos |

### Regras de negócio fixas (não configuráveis no perfil)

- **Cliente:** não existe permissão de Excluir; apenas inativar (requer `editar`).
- **Comissões:** consultor nunca vê comissão de outro consultor (filtro obrigatório na API).
- **Administrador:** bypass total (nome do perfil / flag sistema).

### UI do perfil (modernização planejada)

- **Não criar perfis automaticamente** — no sistema existe apenas **Administrador** (já criado); demais perfis são **criados e configurados manualmente** pela gestão.
- Melhorar somente o **módulo Perfis de Acesso** para marcar exatamente o desejado.
- **Matriz completa** em cada **módulo e subárea**, com 5 colunas independentes:

| Ver | Criar | Editar | Excluir | Ver de todos |
|-----|-------|--------|---------|--------------|

- **“Ver de todos”** em **cada linha** (módulo e subárea) — autonomia total; sem atalhos que forcem pacote de permissões.
- **Modelos sugeridos** (opcional na UI): botão “Aplicar modelo…” que **preenche** a matriz sem criar perfil no banco — usuário salva quando quiser.
- Texto de ajuda curto por linha (o que “Ver de todos” faz naquela subárea).

### Central (Home) — adaptativa ao perfil

- Cards, KPIs, gráficos e “próximos vencimentos” só aparecem se o usuário tiver **`ver`** no recurso correspondente.
- Números e listas respeitam o **mesmo filtro de dados** das APIs (ex.: sem Financeiro → sem cards de receita/a pagar; Comercial só vinculados → pipeline e contagens só dos leads do usuário).
- Implementação: `GET /api/dashboard/bootstrap` passa a receber sessão, chamar `authorize` e aplicar escopo antes de agregar (Fase 2, junto ou logo após Comercial).

### Catálogo completo — módulos e subáreas (v1)

Cada linha = uma linha na matriz do perfil.

| Área | Recurso (id técnico) |
|------|----------------------|
| **Central** | `central.dashboard` |
| **Comercial** | `comercial.pipeline` |
| **Financeiro** | `financeiro.lancamentos`, `financeiro.comissoes`, `financeiro.extrato`, `financeiro.aprovacoes`, `financeiro.venda_direta` |
| **Clientes** | `clientes.cadastro` |
| **Contratos** | `contratos.lista` |
| **Soluções** | `solucoes.catalogo` |
| **Suporte** | `helpdesk.tickets` |
| **Pós-venda** | `posvenda.tarefas` |
| **Tarefas** | `tarefas.internas` |
| **RH** | `rh.colaboradores` |
| **Relatórios** | `relatorios.comercial`, `relatorios.financeiro`, `relatorios.operacional`, `relatorios.saude_empresa`, `relatorios.prestacao_contas` |
| **Configurações** | `configuracoes.dados_empresa`, `configuracoes.papeis_timbrados`, `configuracoes.construtor_documentos`, `configuracoes.logs`, `configuracoes.perfis`, `configuracoes.usuarios` |
| **Portal cliente** | `portal.acesso` |
| **Minha Caixa** | `alertas.caixa` |

Regras fixas já acordadas continuam valendo (ex.: clientes sem Excluir; comissões nunca de outros consultores).

### Princípios de entrega (cuidado, sem quebrar produção)

1. **Uma etapa por vez** — merge e teste em produção só após validação local.
2. **Compatibilidade** — perfis antigos (só toggles de módulo) migram para matriz com defaults seguros até você reconfigurar manualmente.
3. **API antes da UI decorativa** — bloqueio real na rota; home e menus seguem depois.
4. **Administrador intocado** — bypass; único perfil pré-existente.
5. **Checklist por fase** — login, URL direta, API com outro usuário, home, menu.

### Ordem de implementação (atualizada)

| Fase | Escopo | Entregável testável |
|------|--------|---------------------|
| **1** | Fundação | Catálogo TS + JSON no perfil + tela matriz (subáreas) + `authorize()` + migração leve |
| **2** | Comercial + Central | Filtro leads + dashboard KPIs comercial filtrados |
| **3** | Financeiro + Contratos | Comissões só próprias; lançamentos; contratos vinculados |
| **4** | Clientes, Suporte, Pós-venda, Tarefas, RH, Relatórios, Config (subáreas) | Cada bloco: API → menu → home (se aplicável) |
| **5** | Escopo equipe (Gerente) + log de negações | RH equipe + filtro `equipe` no Comercial |

### Status atual do BL-018

| Item | Estado |
|------|--------|
| Decisões de negócio | ✅ Fechadas |
| Catálogo módulos/subáreas | ✅ Definido (v1); Calendário/Arquivos fora do catálogo até BL-021 |
| Código matriz / `authorize` | ✅ Em produção (UI perfis + `permission-client` + `authorize` nas APIs) |
| Proxy + rotas (`canAccessPageRoute`) | ✅ Única barreira de rota (granular + fallback legado) |
| Sidebar (`canViewNavItem`) | ✅ Por `resourceId` / agregados Financeiro·Relatórios·Config |
| Guards de página (Ver/Criar/Editar) | ✅ Módulos principais |
| APIs críticas sem gate | ✅ Corrigido (DELETE lançamento, POST histórico pós-venda) |
| Busca global (`global-search`) | ✅ Usa `canViewResourceClient` por recurso |
| Piloto Comercial + escopo leads | ✅ |
| Financeiro (subáreas) + escopo lançamentos | ✅ |
| Central adaptativa + bootstrap vazio sem `central.dashboard` | ✅ |
| Central — KPIs Suporte / Tarefas / Clientes com mesmo escopo dos módulos | ✅ (2026-05-18) |
| Perfis pré-criados no código | ❌ Não faremos (só Administrador) |
| **Validação formal com perfis de teste** | ✅ Manual (gestão, 2026-05-18) |
| **Log de negações de permissão (suporte)** | ⏳ Auditoria `RBAC negado` em `rbac-gate`; sem tela dedicada (nice-to-have) |
| **Escopo “Ver de todos”** | ✅ Módulos de operação + relatórios |
| **Escopo equipe / Gerente Comercial** | ➡️ **BL-022** (depende cadastro de equipe/departamento) |
| **Desligar `hasModuleAccess` no proxy** | ✅ Removido; só `canAccessPageRoute` |

**Resíduos fora do MVP (documentados):** `/calendario` e `/arquivos` sem RBAC até produto maduro → **BL-021**; portal cliente com fluxo próprio (`resolvePortalContext`); Config logs/usuários sem filtro por criador (baixa prioridade).

---

## BL-021 - Calendário da equipe e Drive interno (evolução de produto)
- `status`: `planejado`
- `prioridade`: `P2` (após BL-018 MVP — RBAC desses módulos **só quando o produto estiver pronto**)
- `impacto`: Médio (produtividade da operação; hoje são protótipos locais)
- `decisão de UX (2026-05-18)`:
  - **Não** incluir Calendário nem Arquivos na sidebar nem na matriz de perfis neste ciclo.
  - Reintroduzir `calendario.equipe` / `arquivos.drive` no catálogo quando o MVP estiver pronto.
- `decisão RBAC (2026-05-18 — gestão)`:
  - Rotas `/calendario` e `/arquivos` permanecem **sem gate** por enquanto: usuários não conhecem os links, telas vazias/mock, risco aceito.
  - **Não implementar RBAC** nestas rotas até o módulo ter dados reais e entrar no menu.
  - Na entrega do MVP do módulo: catálogo + matriz + `canAccessPageRoute` + gates em APIs + escopo de dados (se aplicável).
- `situação atual`:
  - `/calendario` — eventos em memória; preparação para Google Calendar.
  - `/arquivos` — drive mock em memória; preparação para Google Drive.
  - Sem APIs de persistência; sem entrada no menu principal; proxy deixa URL passar para qualquer usuário logado.
- `escopo futuro (MVP de módulo)`:
  1. Modelo de dados + APIs (eventos, pastas/arquivos, permissões por pasta).
  2. Integração ou stub documentado (Google Calendar / Drive).
  3. Entrada na sidebar **somente** quando o MVP estiver utilizável (alinhado ao BL-016 se aplicável).
  4. **RBAC completo** (recursos no catálogo, proxy, APIs, escopo).
  5. Revisar matriz de perfis (desacoplar de “Tarefas” se fizer sentido de negócio).
- `critério de aceite`:
  - Usuário com permissão vê o módulo no menu, persiste dados no servidor e respeita Ver/Criar/Editar/Excluir na API.
  - Usuário sem permissão: bloqueio em URL direta, API e UI.

---

## BL-022 - RBAC: escopo por equipe / departamento (Gerente Comercial e similares)
- `status`: `planejado`
- `prioridade`: `P2` (após existir modelo de negócio para “quem pertence a qual equipe”)
- `impacto`: Alto para gestores que precisam ver a operação do time sem ver a empresa inteira
- `contexto (2026-05-18)`:
  - BL-018 entrega apenas `todos` vs `vinculados` (registros do próprio usuário / colaborador no lead).
  - **Não há hoje** cadastro de departamento, equipe comercial, equipe de suporte ou financeiro vinculado ao usuário — impossível definir “pessoas do comercial” no sistema.
  - Decisão: **planejar agora, implementar depois** do cadastro organizacional.
- `pré-requisitos de produto/dados`:
  1. Modelo de **equipe** ou **departamento** (ex.: Comercial, Suporte, Financeiro) e vínculo `Usuario` ↔ equipe (e opcionalmente líder/gerente).
  2. Regras com gestão: gerente vê todos os leads/tickets/tarefas dos membros da equipe; consultor continua só vinculados.
  3. Novo valor de escopo no catálogo (ex.: `equipe`) além de `todos` / `vinculados`, ou flag “Ver equipe” por módulo.
- `entregas sugeridas (quando houver cadastro)`:
  1. CRUD ou config em RH/Config para equipes e membros.
  2. `authorize` + filtros em Comercial (piloto), depois Suporte, Tarefas, Relatórios.
  3. Perfil tipo “Gerente Comercial” documentado na matriz (sem seed automático de perfil).
- `critério de aceite`:
  - Gerente com escopo equipe vê apenas registros dos usuários listados na equipe dele; não vê outras equipes.
  - Consultor sem “Ver de todos” continua restrito aos vinculados próprios.
- `referência`: decisão #7 e Fase 5 do BL-018 (escopo `equipe`).

---

## BL-019 - Módulo Marketing (planejamento e MVP)
- `status`: `em_analise`
- `prioridade`: `P1` (após piloto RBAC ou em paralelo na fase de descoberta)
- `impacto`: Muito alto (origem de leads, campanhas, ROI, apoio direto às vendas)
- `contexto`:
  - Ainda **não existe módulo Marketing** no sistema; Comercial cobre pipeline, mas não campanhas, canais, nutrição nem métricas de aquisição.
- `fase 0 — descoberta (antes de codar)`:
  - Definir: o que é “Marketing” para a PAM (campanhas, landing, e-mail, redes, eventos, UTMs, orçamento por canal).
  - Personas: quem usa (gestor comercial, marketing, diretoria).
  - Integração com Comercial: lead nasce de qual origem/campanha; atribuição multi-touch (futuro).
- `MVP sugerido (proposta)`:
  - Cadastro de **campanhas** e **canais** (origem).
  - Vínculo obrigatório/opcional campanha → lead no Comercial.
  - Dashboard: leads por campanha, custo estimado (manual), conversão até Fechado.
- `critério de aceite` (MVP):
  - Criar campanha, registrar leads com origem, relatório simples de conversão por campanha.
  - Consultor vê apenas campanhas/leads do seu escopo (alinhado ao BL-018).

---

## BL-020 - Assistente IA operacional (leitura + ação no sistema)
- `status`: `planejado`
- `prioridade`: `P1` (execução **faseada**; início após BL-018 piloto)
- `impacto`: Muito alto (produtividade, gestão proativa, diferencial competitivo)
- `visão`:
  - Assistente que **conhece o estado do sistema** (leads, financeiro, contratos, tarefas, alertas) e **ajuda o usuário a decidir e executar** — não chat genérico.
  - Exemplos: “o que fazer hoje”, próximos passos por lead, importar planilha/PDF com **preview e confirmação** antes de gravar.
- `pré-requisitos`:
  - BL-018 (permissões: IA só acessa o que o usuário pode ver).
  - BL-007 (logs e rastreio de ações sugeridas/aceitas).
  - APIs internas estáveis por domínio (read + write com auditoria).
- `fases`:
  1. **Copiloto leitura** — resumo do dia, pendências, explicação de telas (sem escrita).
  2. **Copiloto com confirmação** — sugere criar/editar registro; usuário aprova em um clique.
  3. **Ingestão de ficheiros** — “coloque este CSV nestes lançamentos” com mapeamento revisável.
  4. **Proativo** — alertas de melhoria, metas, riscos (integração com BL-010/015).
- `critério de aceite` (fase 2 fechável):
  - Pelo menos 3 ações executáveis com confirmação (ex.: criar tarefa, registrar interação, sugerir lançamento).
  - Log de auditoria: quem pediu, o que a IA sugeriu, o que foi aceito/rejeitado.
- `nota`:
  - IN-001 (IA em documentos) permanece como subcaso da fase 2/3.

---

## Roadmap sugerido (sem datas rígidas)

### Onda A — Confiança (agora)
- BL-018 fases 1–3 (catálogo + API + piloto Comercial/Contratos/Financeiro escopo)
- BL-007, BL-006

### Onda B — Operação e vendas
- BL-019 fase 0 + MVP
- BL-001, BL-009 (concluir), BL-016

### Onda C — Inteligência e escala
- BL-011–014, BL-013
- BL-020 fases 1–2
- BL-017 (GovRadar) quando Onda A–B estiverem estáveis

---

## Ideias novas para ganho de valor (avaliar)

## IN-001 - Assistente de composição de documento (IA guiada)
- Sugestão automática de texto por tipo de documento, setor e perfil do cliente.
- **Encaixe:** subitem de **BL-020** (fase 2/3), não projeto isolado.

## IN-002 - Biblioteca de blocos institucionais reutilizáveis
- Blocos prontos (cláusulas, termos, apresentação, escopo, condições comerciais).

## IN-003 - Aprovação de documento por workflow
- Fluxo de aprovação (autor > gestor > diretoria) antes de envio final.

## IN-004 - Assinatura eletrônica integrada
- Integração com provedor de assinatura para fechar ciclo sem sair da plataforma.

## IN-005 - Métricas de conversão por modelo
- Taxa de abertura, resposta e conversão por template/modelo.

## IN-006 - Indicador / verificação de uso de WhatsApp por número
- `status`: `pendente`
- `prioridade`: `P2`
- `impacto`: Baixo/Médio (nice-to-have; depende de políticas da Meta)
- `contexto`:
  - Não existe API pública genérica do tipo “este telefone tem WhatsApp?” para validação em formulário.
  - Caminho oficial: **WhatsApp Business Platform** (Cloud API / Business), com limitações, aprovação e fluxos de mensagem — não substitui máscara de telefone nem validação simples.
- `escopo futuro` (se houver demanda):
  - Avaliar integração comercial (ex.: após envio de template ou tentativa de conversa) vs. expectativa de “validar no blur do campo”.
  - Documentar limitações de privacidade e termos de uso para o time.
- `critério de aceite` (quando retomar):
  - Definição clara do que o produto promete (“tentativa de contato” vs. “número verificado”) e implementação alinhada à Meta, sem dependência de serviços não oficiais.

---

## Registro de decisões

- [2026-04-14] Cadastro de cliente em produção estabilizado após hotfix de schema.
- [2026-04-14] Prioridade de negócio definida: refino do Construtor de Documentos com identidade visual da empresa.
- [2026-05-08] Registrado para futuro: RBAC granular em `Perfis de Acesso` com permissões por módulo (`Ver`, `Criar`, `Editar`, `Excluir`), incluindo possibilidade de ações específicas (ex.: `dar baixa` no Financeiro) sem execução imediata.
- [2026-05-11] Planejamento do módulo **Extrator Inteligente (GovRadar)** consolidado no backlog como **BL-017** (apenas planejamento; execução adiada até após ajustes pontuais de release em produção no Railway).
- [2026-05-11] Registrado **IN-006**: verificação/indicador de uso de WhatsApp por número — depende de API comercial Meta e políticas; sem validação mágica em campo genérico (ver item no backlog).
- [2026-05-12] Planejamento de **RBAC granular** consolidado como item de backlog **BL-018** (detalhe de entregas e critérios de aceite); decisão de 2026-05-08 permanece como contexto histórico.
- [2026-05-15] **Prioridade P0:** BL-018 (consultor só vê vínculos próprios). GovRadar (BL-017) confirmado como importante mas adiado. **BL-019** Marketing entra em descoberta. **BL-020** IA assistente completa (ler + agir) planejada em fases após RBAC. Backup completo verificado em `backups/archive/2026-05-15T18-00-31`.
- [2026-05-15] **BL-018** em análise: diagnóstico “UI ≠ segurança”; plano em 5 fases com piloto Comercial; catálogo de recursos e presets documentados no backlog.
- [2026-05-15] BL-018 refinado: **sem criar perfis** no código; matriz **Ver/Criar/Editar/Excluir/Ver de todos** em **cada subárea**; **Central adaptativa** ao perfil; entrega **etapa a etapa** com testes.
- [2026-05-15] Hotfix produção: admin/sessão (`session-permissions`, cookie renovado em `/api/auth/session`) — **não** substitui BL-018.
- [2026-05-18] BL-018 **MVP concluído** — validação manual OK; Central com escopo Suporte/Tarefas/Clientes; resíduos BL-021/BL-022 documentados.
- [2026-05-18] Decisão: Calendário/Arquivos sem RBAC até produto maduro (**BL-021**). Escopo gerente/equipe adiado até cadastro organizacional (**BL-022**).
