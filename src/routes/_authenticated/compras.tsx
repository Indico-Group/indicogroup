import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({ meta: [{ title: "Compras — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Compras"
      description="Gestão de fornecedores e ordens de compra"
      features={[
        "Cadastro de fornecedores",
        "Ordens de compra",
        "Recebimento parcial ou total",
        "Actualização automática do estoque",
        "Contas a pagar geradas",
        "Histórico por fornecedor",
      ]}
    />
  ),
});
