Backups completos (PAM Gestor)
==============================

Cada execução cria uma pasta em archive/ com data-hora no nome.

Na raiz do repositório:

1) Criar backup
   npm run backup:full

   Requisitos:
   - PostgreSQL: ferramentas de cliente no PATH (pg_dump / pg_restore).
     No Windows, instale o PostgreSQL ou o "Command Line Tools" e confirme
     no PowerShell: pg_dump --version
   - Ficheiro .env com DATABASE_URL (para exportar a base).

   Opcional: BACKUP_SKIP_DATABASE=1 — só ficheiros, Prisma e .env (sem dump).

2) Verificar um backup
   npm run backup:verify -- backups/archive/<nome-da-pasta>

3) Restaurar (substitui a base apontada por DATABASE_URL e repõe uploads/.env)
   npm run restore:full -- backups/archive/<nome-da-pasta>

   --yes        confirma sem prompt
   --skip-env   não sobrescreve .env na raiz
   --skip-files não repõe pastas de uploads

Segurança: cada backup inclui secrets/ (cópia dos .env). Guarde archive/ fora
do repositório público e trate como dado sensível.
