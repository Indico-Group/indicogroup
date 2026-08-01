import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Envolve o conteúdo de um módulo e bloqueia o acesso quando o papel do
 * utilizador não está autorizado para aquela rota.
 */
export function RequireAccess({ path, children }: { path: string; children: React.ReactNode }) {
  const { can, roles, isLoading } = usePermissions();

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted/40" />;
  }

  if (!can(path)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              O seu perfil não tem permissão para aceder a este módulo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Papéis actuais:{" "}
              <span className="font-medium text-foreground">
                {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "sem papel atribuído"}
              </span>
            </p>
            <Button asChild>
              <Link to="/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
