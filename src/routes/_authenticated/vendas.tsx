import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Vendas"
      description="Frente de caixa (PDV) e gestão de pedidos"
      features={[
        "Venda rápida no balcão",
        "Venda por mesa com mapa visual",
        "Venda para entrega (delivery)",
        "Cancelar e estornar vendas",
        "Descontos e acréscimos",
        "Formas de pagamento múltiplas (Dinheiro, M-Pesa, e-Mola, POS)",
        "Emissão de comprovante em PDF/WhatsApp",
        "Pagamento misto",
      ]}
    />
  ),
});
