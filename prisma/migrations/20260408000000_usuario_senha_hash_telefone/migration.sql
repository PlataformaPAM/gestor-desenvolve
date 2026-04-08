-- Campos de autenticação e contato em Usuario (alinhado ao schema.prisma; faltavam na migration init).
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "telefone" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "senhaHash" TEXT;
