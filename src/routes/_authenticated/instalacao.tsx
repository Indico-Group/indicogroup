import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { verificarInstalacao, type CheckRow } from "@/lib/instalacao.functions";

export const Route = createFileRoute("/_authenticated/instalacao")({
  head: () => ({
    meta: [
      { title: "Verificação de Instalação · Aldeia Mesa" },
      { name: "description", content: "Auditoria pós-instalação: administrador, permissões e triggers." },
    ],
  }),
  component: InstalacaoPage,
});

const FIXES: Record<string, string> = {
  "1º Administrador":
    "Registe o primeiro utilizador em /auth — o trigger promove-o automaticamente a admin. Se já houver utilizadores sem admin, contacte o suporte para reexecutar o script de seed.",
  "Trigger promoção (on_auth_user_created)":
    "O trigger foi removido. Reexecute o script de seed no backend para recriar 'on_auth_user_created' em auth.users.",
  "GRANT EXECUTE has_role → authenticated":
    "Execute: GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;",
  "GRANT SELECT user_roles → authenticated":
    "Execute: GRANT SELECT ON public.user_roles TO authenticated;",
  "GRANTs CRUD profiles → authenticated":
    "Execute: GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "OK") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "PENDENTE") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "OK" ? "default" : status === "PENDENTE" ? "secondary" : "destructive";
  return <Badge variant={variant as any}>{status}</Badge>;
}

function InstalacaoPage() {
  const run = useServerFn(verificarInstalacao);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["verificar-instalacao"],
    queryFn: () => run(),
  });

  const rows: CheckRow[] = data ?? [];
  const falhas = rows.filter((r) => r.status === "FALHA");
  const pendentes = rows.filter((r) => r.status === "PENDENTE");
  const oks = rows.filter((r) => r.status === "OK");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificação de Instalação"
        description="Auditoria da configuração base do sistema: administrador, permissões e triggers."
        icon={ShieldCheck}
      >
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Reexecutar
        </Button>
      </PageHeader>

      {error ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível executar a verificação</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aprovadas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-500">{oks.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-500">{pendentes.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Falhas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{falhas.length}</CardContent>
        </Card>
      </div>

      {falhas.length === 0 && pendentes.length === 0 && !isLoading && rows.length > 0 ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>Instalação íntegra</AlertTitle>
          <AlertDescription>
            Todas as verificações passaram. O sistema está configurado correctamente.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resultado das verificações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A executar verificações…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem resultados.</p>
          ) : (
            rows.map((row) => {
              const fix = row.status !== "OK" ? FIXES[row.verificacao] : null;
              return (
                <div
                  key={row.verificacao}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <StatusIcon status={row.status} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.verificacao}</p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{row.detalhe}</p>
                    {fix ? (
                      <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                        <p className="font-medium mb-1">Como corrigir</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{fix}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
