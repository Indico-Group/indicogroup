import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — INDICO GROUP" },
      { name: "description", content: "Acesso seguro ao Sistema Integrado de Gestão Comercial INDICO GROUP." },
      { property: "og:title", content: "INDICO GROUP — Sistema Integrado de Gestão Comercial" },
      { property: "og:description", content: "Acesso seguro à plataforma de gestão empresarial." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha mínima de 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
      return;
    }
    toast.success("Bem-vindo ao INDICO GROUP!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-hero p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" variant="light" staticOnly />
        </div>

        <Card className="border-white/10 bg-card/95 shadow-elegant backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Sistema Integrado de Gestão</p>
            <CardTitle className="text-2xl sm:text-3xl">Bem-vindo de volta</CardTitle>
            <CardDescription>Inicie sessão para gerir operações, equipa, stock e resultados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email de acesso</Label>
                <Input id="email" name="email" type="email" autoComplete="username" placeholder="nome@empresa.co.mz" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Introduza a sua senha" required />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "A autenticar..." : "Entrar no sistema"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                O acesso é criado pelo Administrador ou Gerente. Se ainda não tem credenciais, contacte um responsável autorizado.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/60">
          Desenvolvido por <span className="text-gold">Dausse de Clune do Rosário</span>
        </p>
        <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-white/40">
          INDICO GROUP · Gestão com clareza
        </p>
      </div>
    </main>
  );
}
