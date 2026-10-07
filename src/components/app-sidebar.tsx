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
  BriefcaseBusiness,
  Receipt,
  BedDouble,
  FileText,
  Utensils,
  ChefHat,
  Undo2,
  Ruler,
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
import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const operacoes: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Caixa", url: "/caixa", icon: Wallet },
  { title: "Hospedagem", url: "/hospedagem", icon: BedDouble },
  { title: "Faturas e Cotações", url: "/documentos", icon: FileText },
  { title: "Mesas", url: "/mesas", icon: Utensils },
  { title: "Cozinha", url: "/cozinha", icon: ChefHat },
  { title: "Devoluções", url: "/devolucoes", icon: Undo2 },
];

const catalogo: Item[] = [
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Categorias", url: "/categorias", icon: Tags },
  { title: "Unidades de medida", url: "/unidades", icon: Ruler },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Compras", url: "/compras", icon: Truck },
];

const pessoas: Item[] = [
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Usuários", url: "/usuarios", icon: ShieldCheck },
];

const rh: Item[] = [
  { title: "Dashboard RH", url: "/rh", icon: BriefcaseBusiness },
  { title: "Funcionários", url: "/funcionarios", icon: UserCog },
  { title: "Folha Salarial", url: "/folha-salarial", icon: Receipt },
];

const gestao: Item[] = [
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Financeiro", url: "/financeiro", icon: Banknote },
  { title: "Auditoria", url: "/auditoria", icon: History },
];

const sistema: Item[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Instalação", url: "/instalacao", icon: ShieldCheck },
  { title: "Backup", url: "/backup", icon: DatabaseBackup },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { can, roles } = usePermissions();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    navigate({ to: "/auth", replace: true });
  };

  const renderGroup = (label: string, items: Item[]) => {
    const visible = items.filter((i) => can(i.url));
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
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
  };


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
        {renderGroup("Recursos Humanos", rh)}
        {renderGroup("Gestão", gestao)}
        {renderGroup("Sistema", sistema)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && roles.length > 0 && (
          <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-sidebar-foreground/60">
            {roles.map((r) => ROLE_LABELS[r]).join(" • ")}
          </p>
        )}
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
