import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Clientes"
      description="Cadastro e programa de fidelização"
      features={[
        "Nome, telefone, email e aniversário",
        "Histórico de compras",
        "Total gasto e ticket médio",
        "Programa de pontos e descontos",
        "Observações e preferências",
      ]}
    />
  ),
});
