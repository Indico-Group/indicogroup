import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Estoque"
      description="Controlo de inventário e movimentações"
      features={[
        "Entradas e saídas manuais",
        "Transferências entre pontos",
        "Perdas, quebras e validade",
        "Lote e rastreabilidade",
        "Inventário geral e parcial",
        "Diferenças (faltas e sobras)",
        "Valor total do estoque",
        "Histórico completo de movimentações",
      ]}
    />
  ),
});
