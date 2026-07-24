import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "Backup — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Backup & Restauração"
      description="Segurança e continuidade dos dados"
      features={[
        "Backup automático agendado",
        "Backup manual imediato",
        "Restauração ponto-a-ponto",
        "Histórico de backups",
        "Notificações de sucesso/falha",
      ]}
    />
  ),
});
