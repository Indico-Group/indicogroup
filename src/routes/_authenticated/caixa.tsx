import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({ meta: [{ title: "Caixa — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Caixa"
      description="Controlo de abertura, fecho e movimentações de caixa"
      features={[
        "Abrir e fechar caixa",
        "Valor inicial e valor de fecho",
        "Entradas e saídas",
        "Sangrias e reforços",
        "Diferença de caixa automática",
        "Histórico completo por turno",
        "Relatório de fecho imprimível",
      ]}
    />
  ),
});
