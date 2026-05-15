# Backlog de Produto e Evolução

Objetivo: centralizar pendências, melhorias e novidades para evitar perda de contexto.

## Como usar

- Atualizar este arquivo ao final de cada ciclo de trabalho.
- Cada item deve ter: prioridade, status, impacto e critério de aceite.
- Status permitidos: `pendente`, `em_analise`, `planejado`, `em_execucao`, `concluido`.

## Priorização atual (visão executiva)

1. Refinamento final do Construtor de Documentos com identidade visual (papel timbrado/fundo).
2. Evolução do uso de documentos nos módulos (geração, preview, PDF e envio).
3. Estabilização técnica pós-incidente (lint crítico e observabilidade).
4. Governança operacional de produção (runbook e validações pós-deploy).
5. **Futuro:** módulo Extrator / GovRadar (ver BL-017) — após estabilização de release em produção.

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
- `prioridade`: `P2` (grande iniciativa; iniciar após release e critérios de produção)
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
- `status`: `planejado`
- `prioridade`: `P1` (grande melhoria de governança; execução em fases após estabilização do fluxo atual)
- `impacto`: Muito alto (segurança, LGPD operacional, experiência por papel — ex.: consultor externo sem ver financeiro global; Configurações só em subáreas como Comissões)
- `contexto`:
  - Hoje o perfil habilita/desabilita **módulos inteiros**, sem controle fino de ações, subpáginas nem escopo de dados (ex.: contratos só vinculados à pessoa).
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

---

## Ideias novas para ganho de valor (avaliar)

## IN-001 - Assistente de composição de documento (IA guiada)
- Sugestão automática de texto por tipo de documento, setor e perfil do cliente.

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
