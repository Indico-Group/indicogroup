import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Categorias"
      description="Organização do menu por tipo de produto"
      features={[
        "Bebidas (Refrigerantes, Cervejas, Whisky, Vinhos, Águas, Sucos, Cocktails)",
        "Comidas e Pratos principais",
        "Sobremesas",
        "Categorias personalizadas",
        "Cores e ícones por categoria",
      ]}
    />
  ),
});
