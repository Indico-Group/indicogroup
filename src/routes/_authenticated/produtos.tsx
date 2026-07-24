import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Produtos"
      description="Catálogo completo do bar e restaurante"
      features={[
        "Código, nome, categoria e fornecedor",
        "Preço de compra, venda e lucro automático",
        "Código de barras e foto",
        "Estoque atual e mínimo",
        "Ficha técnica (ingredientes por prato)",
        "Unidade de medida",
        "Estado activo/inactivo",
      ]}
    />
  ),
});
