import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita bundle com DMMF antigo do Prisma após `prisma generate` (corrige create/update com novos campos).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
