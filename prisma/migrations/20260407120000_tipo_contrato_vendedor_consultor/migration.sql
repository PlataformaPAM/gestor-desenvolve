-- AlterEnum: novos valores para contratos de consultores e fornecedores
ALTER TYPE "TipoContrato" ADD VALUE 'consultor';
ALTER TYPE "TipoContrato" ADD VALUE 'especialista';
ALTER TYPE "TipoContrato" ADD VALUE 'vendedor';
ALTER TYPE "TipoContrato" ADD VALUE 'prestador_servico';
ALTER TYPE "TipoContrato" ADD VALUE 'profissional_liberal';
