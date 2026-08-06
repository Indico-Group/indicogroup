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
      { title: "Entrar — Aldeia Mesa" },
      { name: "description", content: "Acesso ao sistema de gestão do Bar e Restaurante Aldeia Mesa." },
      { property: "og:title", content: "Aldeia Mesa — Sistema de Gestão" },
      { property: "og:description", content: "Acesso restrito à equipa do Bar e Restaurante Aldeia Mesa." },
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
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-hero p-4">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" variant="light" staticOnly />
        </div>

        <Card className="border-white/10 bg-card/95 shadow-elegant backdrop-blur">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Bem-vindo</CardTitle>
            <CardDescription>Entre com as suas credenciais para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="voce@aldeiamesa.co.mz" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                As contas são criadas pelo Administrador ou Gerente. Contacte-os para obter acesso.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/60">
          Desenvolvido por <span className="text-gold">Dausse de Clune do Rosário</span>
        </p>
      </div>
    </div>
  );
}

