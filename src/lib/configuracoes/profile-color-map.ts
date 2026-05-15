import type { PerfilAcesso } from "@/lib/configuracoes/types";

export type ProfileColorStyle = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildProfileColorMap(perfis: PerfilAcesso[]): Map<string, ProfileColorStyle> {
  const usedHues = new Set<number>();
  const byId = new Map<string, ProfileColorStyle>();
  for (const perfil of perfis) {
    const base = hashString(`${perfil.id}:${perfil.nome}`) % 360;
    let hue = base;
    while (usedHues.has(hue)) {
      hue = (hue + 37) % 360;
    }
    usedHues.add(hue);
    byId.set(perfil.id, {
      backgroundColor: `hsl(${hue} 90% 94%)`,
      borderColor: `hsl(${hue} 70% 76%)`,
      color: `hsl(${hue} 70% 36%)`,
    });
  }
  return byId;
}
