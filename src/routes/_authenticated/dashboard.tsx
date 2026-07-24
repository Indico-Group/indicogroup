import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aldeia Mesa" },
      { name: "description", content: "Painel de controlo em tempo real do Bar e Restaurante Aldeia Mesa." },
    ],
  }),
  component: Dashboard,
});

const fmtMZN = (v: number) =>
  new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN", maximumFractionDigits: 0 }).format(v);

// Dados de demonstração — serão substituídos por queries reais na Fase 2 (Vendas/Caixa).
const salesTrend = [
  { day: "Seg", vendas: 12400, lucro: 4200 },
  { day: "Ter", vendas: 15800, lucro: 5100 },
  { day: "Qua", vendas: 11200, lucro: 3800 },
  { day: "Qui", vendas: 18600, lucro: 6400 },
  { day: "Sex", vendas: 26400, lucro: 9200 },
  { day: "Sáb", vendas: 34800, lucro: 12100 },
  { day: "Dom", vendas: 22100, lucro: 7800 },
];

const topProducts = [
  { name: "2M Cerveja", qty: 148 },
  { name: "Frango Grelhado", qty: 96 },
  { name: "Coca-Cola 350ml", qty: 84 },
  { name: "Whisky JB Dose", qty: 62 },
  { name: "Prato Xima", qty: 54 },
];

const lowStock = [
  { name: "Whisky JB 750ml", qty: 2, min: 5 },
  { name: "Vinho Tinto Casa", qty: 3, min: 8 },
  { name: "Água 500ml", qty: 6, min: 24 },
];

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "gold" | "secondary" | "default";
  trend?: string;
}

function KpiCard({ label, value, hint, icon: Icon, variant = "default", trend }: KpiProps) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-primary text-primary-foreground",
    gold: "bg-gradient-gold text-gold-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    default: "bg-card text-card-foreground border",
  };
  const isColored = variant !== "default";

  return (
    <Card className={`${styles[variant]} shadow-elegant relative overflow-hidden`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-xs font-medium uppercase tracking-wider ${isColored ? "opacity-80" : "text-muted-foreground"}`}>
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
            {hint && (
              <p className={`mt-1 text-xs ${isColored ? "opacity-75" : "text-muted-foreground"}`}>{hint}</p>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isColored ? "bg-white/20" : "bg-muted"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${isColored ? "opacity-90" : "text-primary"}`}>
            <ArrowUpRight className="h-3 w-3" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const hoje = new Date().toLocaleDateString("pt-MZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Visão geral do dia — ${hoje}`}
        actions={
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-primary" />
            Caixa aberto
          </Badge>
        }
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Venda do Dia" value={fmtMZN(34800)} icon={DollarSign} variant="primary" trend="+18% vs ontem" />
        <KpiCard label="Lucro do Dia" value={fmtMZN(12100)} icon={TrendingUp} variant="gold" trend="Margem 34,7%" />
        <KpiCard label="Venda da Semana" value={fmtMZN(141300)} icon={ShoppingCart} variant="secondary" hint="7 dias corridos" />
        <KpiCard label="Venda do Mês" value={fmtMZN(586200)} icon={Wallet} hint="Meta: 750.000 MZN" />
      </div>

      {/* KPIs secundários */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Nº de Vendas" value="127" icon={ShoppingCart} hint="Hoje" />
        <KpiCard label="Clientes" value="94" icon={Users} hint="Atendidos hoje" />
        <KpiCard label="Ticket Médio" value={fmtMZN(274)} icon={DollarSign} hint="Por venda" />
        <KpiCard label="Venda Anual" value={fmtMZN(4820000)} icon={TrendingUp} hint="Acumulado 2026" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vendas vs Lucro (últimos 7 dias)</CardTitle>
            <CardDescription>Evolução diária em Meticais</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(v: number) => fmtMZN(v)}
                />
                <Area type="monotone" dataKey="vendas" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="lucro" stroke="var(--chart-3)" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Mais Vendidos
            </CardTitle>
            <CardDescription>Top 5 do dia</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="qty" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e status */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Estoque Baixo
            </CardTitle>
            <CardDescription>Produtos abaixo do mínimo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Mínimo: {p.min} un.</p>
                </div>
                <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                  {p.qty} un.
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-gradient-hero text-white">
          <CardHeader>
            <CardTitle className="text-white">Status do Caixa</CardTitle>
            <CardDescription className="text-white/70">Turno atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/70">Aberto às</span>
              <span className="font-semibold">08:15</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/70">Valor inicial</span>
              <span className="font-semibold">{fmtMZN(2000)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/70">Entradas</span>
              <span className="font-semibold text-gold">{fmtMZN(34800)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-sm text-white/70">Saídas / Sangrias</span>
              <span className="font-semibold">{fmtMZN(1500)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-white/70">Saldo esperado</span>
              <span className="text-lg font-bold text-gold">{fmtMZN(35300)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
