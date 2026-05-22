-- Permissões granulares por recurso (matriz Ver/Criar/Editar/Excluir/Ver de todos)
ALTER TABLE "PerfilAcesso" ADD COLUMN IF NOT EXISTS "permissoesGranulares" JSONB;
