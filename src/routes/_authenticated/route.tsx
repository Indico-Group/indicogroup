import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { RequireAccess } from "@/components/require-access";
import { Logo } from "@/components/logo";
import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { roles } = usePermissions();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const nome = profile?.full_name || email.split("@")[0] || "Utilizador";
  const inicial = (profile?.full_name || email || "U").charAt(0).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <Logo size="sm" variant="dark" />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <p className="max-w-[180px] truncate text-sm font-medium">{nome}</p>
                <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">{email}</p>
              </div>
              {roles.length > 0 && (
                <Badge variant="secondary" className="hidden md:inline-flex">
                  {roles.map((r) => ROLE_LABELS[r]).join(" • ")}
                </Badge>
              )}
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={nome} className="h-full w-full object-cover" />
                ) : (
                  inicial
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <RequireAccess path={pathname}>
              <Outlet />
            </RequireAccess>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


