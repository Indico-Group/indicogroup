import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Funcionários"
      description="Recursos humanos e folha de pagamento"
      features={[
        "Cadastro completo (nome, cargo, telefone, endereço)",
        "Salário e turno",
        "Data de admissão",
        "Estado activo/inactivo",
        "Foto e código",
      ]}
    />
  ),
});
