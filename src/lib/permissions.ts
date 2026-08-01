import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  supervisor: "Supervisor(a)",
  caixa: "Caixa",
  garcom: "Garçom",
  cozinha: "Cozinha",
  estoque: "Estoque",
};

/** Módulos do sistema e os papéis autorizados a aceder. */
export const MODULE_ACCESS = {
  "/dashboard": ["admin", "gerente", "supervisor", "caixa", "garcom", "cozinha", "estoque"],
  "/vendas": ["admin", "gerente", "supervisor", "caixa", "garcom"],
  "/caixa": ["admin", "gerente", "supervisor", "caixa"],
  "/produtos": ["admin", "gerente", "supervisor", "estoque"],
  "/categorias": ["admin", "gerente", "supervisor", "estoque"],
  "/estoque": ["admin", "gerente", "supervisor", "estoque"],
  "/compras": ["admin", "gerente", "estoque"],
  "/clientes": ["admin", "gerente", "supervisor", "caixa"],
  "/funcionarios": ["admin", "gerente"],
  "/usuarios": ["admin"],
  "/relatorios": ["admin", "gerente", "supervisor"],
  "/financeiro": ["admin", "gerente"],
  "/auditoria": ["admin", "gerente"],
  "/configuracoes": ["admin", "gerente"],
  "/instalacao": ["admin"],
  "/backup": ["admin"],
} satisfies Record<string, AppRole[]>;

export type ModulePath = keyof typeof MODULE_ACCESS;

export function canAccess(path: string, roles: AppRole[]): boolean {
  const allowed = (MODULE_ACCESS as Record<string, AppRole[]>)[path];
  if (!allowed) return true;
  return roles.some((r) => allowed.includes(r));
}

/** Acções sensíveis (escrita) por papel. */
export const ACTIONS = {
  gerirCatalogo: ["admin", "gerente"],
  gerirPessoas: ["admin", "gerente"],
  gerirUtilizadores: ["admin"],
  gerirConfiguracoes: ["admin", "gerente"],
  cancelarVenda: ["admin", "gerente", "supervisor"],
  fecharCaixa: ["admin", "gerente", "supervisor", "caixa"],
} satisfies Record<string, AppRole[]>;

export function canDo(action: keyof typeof ACTIONS, roles: AppRole[]): boolean {
  return roles.some((r) => (ACTIONS[action] as AppRole[]).includes(r));
}
