import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Relatórios"
      description="Análises e exportações em PDF, Excel e CSV"
      features={[
        "Relatórios diário, semanal, mensal e anual",
        "Por funcionário, por caixa e por turno",
        "Por produto, categoria e cliente",
        "Financeiros: lucro, perdas, fluxo de caixa",
        "Estoque e compras",
        "Exportar para PDF, Excel e CSV",
      ]}
    />
  ),
});
