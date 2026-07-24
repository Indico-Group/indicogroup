import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Package,
  Tags,
  Boxes,
  Truck,
  Users,
  UserCog,
  ShieldCheck,
  FileBarChart,
  Banknote,
  Settings,
  DatabaseBackup,
  History,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const operacoes: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Caixa", url: "/caixa", icon: Wallet },
];

const catalogo: Item[] = [
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Categorias", url: "/categorias", icon: Tags },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Compras", url: "/compras", icon: Truck },
];

const pessoas: Item[] = [
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Funcionários", url: "/funcionarios", icon: UserCog },
  { title: "Usuários", url: "/usuarios", icon: ShieldCheck },
];

const gestao: Item[] = [
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Financeiro", url: "/financeiro", icon: Banknote },
  { title: "Auditoria", url: "/auditoria", icon: History },
];

const sistema: Item[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Backup", url: "/backup", icon: DatabaseBackup },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    navigate({ to: "/auth", replace: true });
  };

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-4">
        <div className="px-2">
          <Logo size="md" showText={!collapsed} variant="light" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Operações", operacoes)}
        {renderGroup("Catálogo", catalogo)}
        {renderGroup("Pessoas", pessoas)}
        {renderGroup("Gestão", gestao)}
        {renderGroup("Sistema", sistema)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <p className="px-2 pb-2 pt-1 text-[10px] leading-tight text-sidebar-foreground/50">
            Desenvolvido por
            <br />
            <span className="text-gold">Dausse de Clune do Rosário</span>
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
