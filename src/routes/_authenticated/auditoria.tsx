import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Aldeia Mesa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Auditoria"
      description="Registo completo de todas as operações"
      features={[
        "Quem entrou e saiu (login/logout)",
        "Quem alterou, apagou ou vendeu",
        "Quem cancelou ou estornou",
        "Data, hora, IP e dispositivo",
        "Filtros avançados por utilizador e período",
        "Exportação para análise",
      ]}
    />
  ),
});
