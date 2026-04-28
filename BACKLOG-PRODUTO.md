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

---

## Registro de decisões

- [2026-04-14] Cadastro de cliente em produção estabilizado após hotfix de schema.
- [2026-04-14] Prioridade de negócio definida: refino do Construtor de Documentos com identidade visual da empresa.
