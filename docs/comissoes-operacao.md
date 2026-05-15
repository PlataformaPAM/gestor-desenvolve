# Comissões - Operação e Conciliação

## Pré-requisitos
- Aplicar migration `20260511194000_comissoes_core`.
- Regenerar client Prisma (`npx prisma generate`).

## Fluxo operacional
1. RH cadastra regras de comissão no perfil do consultor (aba `Comissões`).
2. Comercial/Financeiro define participações por venda (`/api/comissoes/participacoes`).
3. Quando lançamento de entrada vira `pago`, o sistema gera/atualiza `ComissaoEvento`.
4. Financeiro aprova em lote (`aprovar_lote`) e marca pagamento (`marcar_pago`).

## Validações críticas
- Participações do mesmo escopo (lead + solução) não podem passar de 100%.
- Comissão só nasce a partir de `Lancamento.status = pago`.
- Mudança de status de `pago` para não pago cancela itens ainda não aprovados/pagos.
- Idempotência por `(origemLancamentoId, consultorId)` evita duplicidade.

## Conciliação mensal
- Competência usa `dataPagamento` do lançamento.
- A consulta em `/api/financeiro/comissoes` retorna cards de `previsto/elegivel/aprovado/pago`.
- Recomenda-se conferência mensal de:
  - Soma de comissões pagas.
  - Soma de recebimentos de origem.
  - Diferença por consultor/lead.

## Observabilidade e auditoria
- Ações auditadas em `LogSistema` módulo `comissoes`:
  - criação/edição/exclusão de regra.
  - criação/edição/exclusão de participação.
  - recalcular por lançamento.
  - aprovação e pagamento em lote.

