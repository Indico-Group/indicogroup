import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Financeiro"
      description="Fluxo de caixa, contas a pagar e a receber"
      features={[
        "Receitas e despesas",
        "Contas a pagar",
        "Contas a receber",
        "Fluxo de caixa consolidado",
        "Cálculo automático de lucro",
        "Categorias de despesas",
      ]}
    />
  ),
});
