import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Configurações"
      description="Preferências do sistema e da empresa"
      features={[
        "Dados do estabelecimento",
        "Logotipo e cores",
        "Modo claro / escuro",
        "Impressoras e comprovantes",
        "Integrações (M-Pesa, e-Mola, WhatsApp)",
        "Notificações",
        "Tempo de sessão",
      ]}
    />
  ),
});
