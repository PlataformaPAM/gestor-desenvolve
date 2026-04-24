# Runbook de Produção: Migrações e Credenciais

Este runbook padroniza as rotinas críticas de produção para evitar drift de schema e indisponibilidade.

## 1) Checklist de validação pós-incidente (rápido)

Executar logo após deploy/migração:

1. Abrir o sistema em produção e validar login.
2. Criar um cliente novo e confirmar retorno 201 na rota `POST /api/clientes`.
3. Abrir Financeiro e confirmar ausência de erro Prisma no log.
4. Abrir Alertas e Dashboard e confirmar carregamento sem erro 500.
5. Verificar logs da aplicação por 5-10 minutos e confirmar ausência de `P2021`/`P2022`.

Validação técnica local (antes de push):

```bash
npm run build
```

Observação: o lint atual do projeto possui erros/avisos legados; tratar em sprint dedicada para não bloquear hotfixes de produção.

## 2) Rotação de credenciais do Postgres (sem downtime)

Objetivo: trocar senha/URL expostas mantendo a aplicação no ar.

### Etapa A - Preparação

1. Gerar nova senha forte.
2. No Railway (Postgres), atualizar a senha/credencial e copiar a nova URL pública e interna.
3. No Railway (serviço da aplicação), preparar atualização da variável `DATABASE_URL`.

### Etapa B - Troca controlada

1. Atualizar `DATABASE_URL` da aplicação para a nova URL interna.
2. Fazer redeploy da aplicação.
3. Validar saúde:
   - login
   - cadastro de cliente
   - tela financeiro
4. Se algo falhar, rollback imediato para URL anterior e novo redeploy.

### Etapa C - Fechamento

1. Revogar credenciais antigas no Postgres.
2. Confirmar que não há scripts, docs ou mensagens com senha antiga.
3. Registrar data/hora da rotação e responsável.

## 3) Procedimento oficial de migração em produção

### Regra de ouro

- Nunca depender de "ajuste manual isolado" sem versionar migration.
- Toda correção de schema deve virar migration em `prisma/migrations/...`.

### Fluxo padrão

1. Criar migration no repositório.
2. Commit/push em `main`.
3. Deploy com start command:

```bash
npx prisma migrate deploy && npm run start
```

4. Validar nos logs da aplicação:
   - `Loaded Prisma config...`
   - `Prisma schema loaded...`
   - `Applying migration ...` ou `No pending migrations to apply`

### Fluxo de emergência (hotfix SQL idempotente)

Quando houver drift e urgência:

1. Criar migration SQL com `IF NOT EXISTS` para colunas, constraints e índices.
2. Aplicar no banco de produção (via conexão pública com SSL), por exemplo:

```bash
npx prisma db execute --file prisma/migrations/<migration_name>/migration.sql
```

3. Versionar a migration no Git e publicar.
4. Fazer redeploy para manter histórico e runtime alinhados.

### Verificações mínimas após migração

1. Cadastro de cliente em produção.
2. Consulta de lançamentos no financeiro.
3. Ausência de erro Prisma recorrente no log por pelo menos 10 minutos.

