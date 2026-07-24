import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Usuários & Permissões"
      description="Controlo de acessos ao sistema"
      features={[
        "Níveis: Administrador, Gerente, Supervisor, Caixa, Garçom, Cozinha, Estoque",
        "Permissões granulares por perfil",
        "Senha criptografada",
        "Último login e histórico de acessos",
        "Activar / Desactivar utilizador",
      ]}
    />
  ),
});
