import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CreditCard,
  Minus,
  Package,
  RefreshCw,
  Receipt,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmpresa } from "@/hooks/use-empresa";
import { usePermissions } from "@/hooks/use-permissions";
import {
  fmtMZN,
  fmtNum,
  PERIODO_LABELS,
  resolveRange,
  useDashboard,
  variacao,
  type PeriodoKey,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de Gestão — INDICO GROUP" },
      {
        name: "description",
        content: "Painel de comando com vendas, lucro, caixa, stock e alertas em tempo real do INDICO GROUP.",
      },
      { property: "og:title", content: "Painel de Gestão — INDICO GROUP" },
      { property: "og:description", content: "Vendas, lucro, caixa, stock e alertas num só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

function Delta({ valor }: { valor: number | null }) {
  if (valor === null || !isFinite(valor)) {
    return <span className="text-xs text-muted-foreground">sem período anterior</span>;
  }
  const pos = valor >= 0;
  const Icon = valor === 0 ? Minus : pos ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${pos ? "text-success" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(valor).toFixed(1)}% vs período anterior
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  footer,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  footer?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  loading?: boolean;
}) {
  const toneText =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <p className={`mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl ${toneText}`}>{value}</p>
            )}
            {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}

function Vazio({ texto = "Sem dados disponíveis" }: { texto?: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

function Dashboard() {
  const [periodo, setPeriodo] = useState<PeriodoKey>("hoje");
  const [custom, setCustom] = useState<{ de: string; ate: string }>({ de: "", ate: "" });
  const [busca, setBusca] = useState("");
  const { config } = useEmpresa();
  const { can, roles } = usePermissions();
  const moeda = config?.moeda || "MZN";

  const range = useMemo(() => resolveRange(periodo, custom), [periodo, custom]);
  const d = useDashboard(range);

  const podeFinanceiro = can("/financeiro");
  const podeStock = can("/estoque");
  const podeCaixa = can("/caixa");

  /* ---------------- Cálculos (dados reais) ---------------- */
  const pagas = d.vendas.filter((v) => v.status === "paga");
  const pagasAnt = d.vendasAnteriores.filter((v) => v.status === "paga");
  const receita = pagas.reduce((s, v) => s + Number(v.total || 0), 0);
  const receitaAnt = pagasAnt.reduce((s, v) => s + Number(v.total || 0), 0);
  const nVendas = pagas.length;
  const ticket = nVendas ? receita / nVendas : 0;
  const ticketAnt = pagasAnt.length ? receitaAnt / pagasAnt.length : 0;

  const itensPagos = d.itens.filter((i) => i.vendas?.status === "paga");
  const custoConhecido = itensPagos.every((i) => Number(i.produtos?.preco_compra ?? 0) > 0) && itensPagos.length > 0;
  const custoTotal = itensPagos.reduce((s, i) => s + Number(i.produtos?.preco_compra ?? 0) * Number(i.quantidade), 0);
  const receitaItens = itensPagos.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const lucro = custoConhecido ? receitaItens - custoTotal : null;
  const margem = custoConhecido && receitaItens > 0 ? ((receitaItens - custoTotal) / receitaItens) * 100 : null;

  const semStock = d.produtos.filter((p) => Number(p.estoque_atual) <= 0);
  const stockBaixo = d.produtos.filter(
    (p) => Number(p.estoque_atual) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo),
  );

  const hojeISO = new Date().toISOString().slice(0, 10);
  const aReceber = d.financeiro.filter((f) => f.tipo === "receita" && f.status === "pendente");
  const aPagar = d.financeiro.filter((f) => f.tipo === "despesa" && f.status === "pendente");
  const vencidos = d.financeiro.filter((f) => f.status === "pendente" && f.vencimento < hojeISO);
  const totalReceber = aReceber.reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalPagar = aPagar.reduce((s, f) => s + Number(f.valor || 0), 0);

  /* Série de evolução */
  const serie = useMemo(() => {
    const dias = Math.max(1, Math.round((range.fim.getTime() - range.inicio.getTime()) / 86400000));
    const porHora = dias <= 1;
    const mapa = new Map<string, { label: string; ordem: number; vendas: number }>();
    if (porHora) {
      for (let h = 0; h < 24; h++)
        mapa.set(String(h), { label: `${String(h).padStart(2, "0")}h`, ordem: h, vendas: 0 });
    }
    for (const v of pagas) {
      const dt = new Date(v.paga_em ?? v.created_at);
      const chave = porHora ? String(dt.getHours()) : dt.toISOString().slice(0, 10);
      const label = porHora
        ? `${String(dt.getHours()).padStart(2, "0")}h`
        : dt.toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit" });
      const ordem = porHora ? dt.getHours() : dt.getTime();
      const cur = mapa.get(chave) ?? { label, ordem, vendas: 0 };
      cur.vendas += Number(v.total || 0);
      mapa.set(chave, cur);
    }
    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem);
  }, [pagas, range]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itensPagos) {
      const nome = i.produtos?.categorias?.nome ?? "Sem categoria";
      m.set(nome, (m.get(nome) ?? 0) + Number(i.subtotal || 0));
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [itensPagos]);

  const topProdutos = useMemo(() => {
    const m = new Map<string, { name: string; qtd: number; valor: number }>();
    for (const i of itensPagos) {
      const cur = m.get(i.produto_id) ?? { name: i.nome_produto, qtd: 0, valor: 0 };
      cur.qtd += Number(i.quantidade || 0);
      cur.valor += Number(i.subtotal || 0);
      m.set(i.produto_id, cur);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  }, [itensPagos]);

  const baixaRotacao = useMemo(() => {
    const vendidos = new Map<string, number>();
    for (const i of itensPagos) vendidos.set(i.produto_id, (vendidos.get(i.produto_id) ?? 0) + Number(i.quantidade));
    return d.produtos
      .map((p) => ({ ...p, vendido: vendidos.get(p.id) ?? 0 }))
      .filter((p) => Number(p.estoque_atual) > 0)
      .sort((a, b) => a.vendido - b.vendido || Number(b.estoque_atual) - Number(a.estoque_atual))
      .slice(0, 6);
  }, [d.produtos, itensPagos]);

  const porMetodo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of d.pagamentos) m.set(p.metodo, (m.get(p.metodo) ?? 0) + Number(p.valor || 0));
    if (m.size === 0) {
      for (const v of pagas) {
        if (!v.metodo_pagamento) continue;
        m.set(v.metodo_pagamento, (m.get(v.metodo_pagamento) ?? 0) + Number(v.total || 0));
      }
    }
    const labels: Record<string, string> = {
      dinheiro: "Dinheiro",
      mpesa: "M-Pesa",
      emola: "e-Mola",
      pos: "POS",
      transferencia: "Transferência",
      misto: "Misto",
    };
    return [...m.entries()].map(([k, v]) => ({ name: labels[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  }, [d.pagamentos, pagas]);

  const entradasCaixa = d.caixa.movimentos
    .filter((m) => m.tipo === "entrada" || m.tipo === "reforco")
    .reduce((s, m) => s + Number(m.valor || 0), 0);
  const saidasCaixa = d.caixa.movimentos
    .filter((m) => m.tipo === "saida" || m.tipo === "sangria")
    .reduce((s, m) => s + Number(m.valor || 0), 0);
  const saldoCaixa = d.caixa.aberta
    ? Number(d.caixa.aberta.valor_abertura || 0) + entradasCaixa - saidasCaixa + receita
    : null;
  const diferencas = d.caixa.sessoes.filter((s) => s.status === "fechada" && Number(s.diferenca || 0) !== 0);

  /* Alertas */
  const alertas = [
    ...(podeStock && semStock.length
      ? [{ id: "esgotados", tone: "danger", titulo: `${semStock.length} produto(s) esgotado(s)`, detalhe: semStock.slice(0, 3).map((p) => p.nome).join(", "), to: "/estoque" }]
      : []),
    ...(podeStock && stockBaixo.length
      ? [{ id: "baixo", tone: "warning", titulo: `${stockBaixo.length} produto(s) abaixo do mínimo`, detalhe: stockBaixo.slice(0, 3).map((p) => p.nome).join(", "), to: "/estoque" }]
      : []),
    ...(podeFinanceiro && vencidos.length
      ? [{ id: "vencidos", tone: "danger", titulo: `${vencidos.length} conta(s) vencida(s)`, detalhe: fmtMZN(vencidos.reduce((s, f) => s + Number(f.valor), 0), moeda), to: "/financeiro" }]
      : []),
    ...(podeFinanceiro && aPagar.length
      ? [{ id: "pagar", tone: "warning", titulo: `${aPagar.length} pagamento(s) pendente(s)`, detalhe: fmtMZN(totalPagar, moeda), to: "/financeiro" }]
      : []),
    ...(podeCaixa && diferencas.length
      ? [{ id: "caixa", tone: "warning", titulo: `${diferencas.length} fecho(s) de caixa com diferença`, detalhe: fmtMZN(diferencas.reduce((s, x) => s + Number(x.diferenca || 0), 0), moeda), to: "/caixa" }]
      : []),
    ...(d.vendas.some((v) => v.status === "aberta")
      ? [{ id: "abertas", tone: "warning", titulo: `${d.vendas.filter((v) => v.status === "aberta").length} venda(s) por fechar`, detalhe: "Vendas ainda não pagas", to: "/vendas" }]
      : []),
  ];

  const toneClasses: Record<string, string> = {
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-warning/40 bg-warning/10 text-foreground",
  };

  /* Atividade recente (com pesquisa) */
  const atividade = useMemo(() => {
    const itensAtividade = [
      ...d.vendas.slice(0, 10).map((v) => ({
        id: `v-${v.id}`,
        quando: v.paga_em ?? v.created_at,
        titulo: `Venda #${v.numero}`,
        desc: `${v.tipo} · ${v.status}`,
        valor: fmtMZN(Number(v.total), moeda),
        to: "/vendas",
        icon: ShoppingCart,
      })),
      ...d.compras.map((c) => ({
        id: `c-${c.id}`,
        quando: c.created_at,
        titulo: `Compra #${c.numero}`,
        desc: `${c.fornecedores?.nome ?? "Sem fornecedor"} · ${c.status}`,
        valor: fmtMZN(Number(c.total), moeda),
        to: "/compras",
        icon: Receipt,
      })),
      ...d.movimentos.map((m) => ({
        id: `m-${m.id}`,
        quando: m.created_at,
        titulo: m.produtos?.nome ?? "Produto",
        desc: `Stock · ${m.tipo}${m.motivo ? ` · ${m.motivo}` : ""}`,
        valor: `${Number(m.quantidade) > 0 ? "+" : ""}${fmtNum(Number(m.quantidade))}`,
        to: "/estoque",
        icon: Boxes,
      })),
      ...d.caixa.movimentos.slice(0, 5).map((m, idx) => ({
        id: `cx-${idx}-${m.created_at}`,
        quando: m.created_at,
        titulo: `Caixa · ${m.tipo}`,
        desc: m.motivo ?? "Movimento de caixa",
        valor: fmtMZN(Number(m.valor), moeda),
        to: "/caixa",
        icon: Wallet,
      })),
    ].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
    const q = busca.trim().toLowerCase();
    return (q ? itensAtividade.filter((i) => `${i.titulo} ${i.desc}`.toLowerCase().includes(q)) : itensAtividade).slice(0, 12);
  }, [d.vendas, d.compras, d.movimentos, d.caixa.movimentos, busca, moeda]);

  const nomePeriodo = periodo === "custom" && custom.de ? `${custom.de} → ${custom.ate || "hoje"}` : PERIODO_LABELS[periodo];

  if (d.error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="font-medium">Não foi possível carregar o painel</p>
          <p className="max-w-md text-sm text-muted-foreground">{(d.error as Error).message}</p>
          <Button onClick={d.refetchAll} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Topo */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {saudacao()}, {config?.nome_empresa || "INDICO GROUP"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              Painel de comando · {nomePeriodo}
              {roles.length > 0 && ` · ${roles.length} perfil(is) activo(s)`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar atividade…"
                className="w-56 pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative" aria-label="Notificações">
                  <Bell className="h-4 w-4" />
                  {alertas.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {alertas.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alertas.length === 0 && <div className="px-2 py-4 text-sm text-muted-foreground">Sem alertas</div>}
                {alertas.map((a) => (
                  <DropdownMenuItem key={a.id} asChild>
                    <Link to={a.to} className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-medium">{a.titulo}</span>
                      <span className="text-xs text-muted-foreground">{a.detalhe}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={d.refetchAll} aria-label="Actualizar dados">
                  <RefreshCw className={`h-4 w-4 ${d.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actualizar dados</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["hoje", "ontem", "semana", "mes", "ano"] as PeriodoKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={periodo === k ? "default" : "outline"}
              onClick={() => setPeriodo(k)}
              className="h-8"
            >
              {PERIODO_LABELS[k]}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={periodo === "custom" ? "default" : "outline"} className="h-8">
                Personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" value={custom.de} onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input type="date" value={custom.ate} onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))} />
              </div>
              <Button size="sm" className="w-full" disabled={!custom.de} onClick={() => setPeriodo("custom")}>
                Aplicar
              </Button>
            </PopoverContent>
          </Popover>
          <div className="relative ml-auto md:hidden">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar…" className="h-9 w-40 pl-8" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Receita"
            value={fmtMZN(receita, moeda)}
            icon={TrendingUp}
            loading={d.isLoading}
            footer={<Delta valor={variacao(receita, receitaAnt)} />}
          />
          <Kpi
            label="Lucro / Margem"
            value={lucro === null ? "Sem dados disponíveis" : fmtMZN(lucro, moeda)}
            hint={margem !== null ? `Margem ${margem.toFixed(1)}% (custo actual)` : "Preço de compra em falta"}
            icon={Wallet}
            tone={lucro !== null && lucro >= 0 ? "success" : "neutral"}
            loading={d.isLoading}
          />
          <Kpi
            label="Nº de vendas"
            value={fmtNum(nVendas)}
            icon={ShoppingCart}
            loading={d.isLoading}
            footer={<Delta valor={variacao(nVendas, pagasAnt.length)} />}
          />
          <Kpi
            label="Ticket médio"
            value={nVendas ? fmtMZN(ticket, moeda) : "Sem dados disponíveis"}
            icon={Receipt}
            loading={d.isLoading}
            footer={<Delta valor={variacao(ticket, ticketAnt)} />}
          />
          {podeStock && (
            <Kpi
              label="Stock baixo"
              value={fmtNum(stockBaixo.length + semStock.length)}
              hint={`${semStock.length} esgotado(s)`}
              icon={Package}
              tone={stockBaixo.length + semStock.length > 0 ? "warning" : "neutral"}
              loading={d.isLoading}
            />
          )}
          {podeFinanceiro && (
            <Kpi
              label="Contas a receber"
              value={aReceber.length ? fmtMZN(totalReceber, moeda) : "Sem dados disponíveis"}
              hint={aReceber.length ? `${aReceber.length} lançamento(s)` : undefined}
              icon={ArrowDownRight}
              tone="success"
              loading={d.isLoading}
            />
          )}
          {podeFinanceiro && (
            <Kpi
              label="Contas a pagar"
              value={aPagar.length ? fmtMZN(totalPagar, moeda) : "Sem dados disponíveis"}
              hint={aPagar.length ? `${aPagar.length} lançamento(s)` : undefined}
              icon={ArrowUpRight}
              tone={aPagar.length ? "danger" : "neutral"}
              loading={d.isLoading}
            />
          )}
          {podeCaixa && (
            <Kpi
              label="Saldo de caixa"
              value={saldoCaixa === null ? "Caixa fechado" : fmtMZN(saldoCaixa, moeda)}
              hint={d.caixa.aberta ? "Sessão aberta" : "Sem sessão aberta"}
              icon={CreditCard}
              loading={d.isLoading}
            />
          )}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução das vendas</CardTitle>
              <CardDescription>Vendas pagas · {nomePeriodo}</CardDescription>
            </CardHeader>
            <CardContent className="h-64 sm:h-72">
              {d.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : serie.every((s) => s.vendas === 0) ? (
                <Vazio />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [fmtMZN(v, moeda), "Vendas"]}
                    />
                    <Area type="monotone" dataKey="vendas" stroke="var(--chart-1)" strokeWidth={2} fill="url(#dashArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vendas por categoria</CardTitle>
              <CardDescription>Distribuição da receita</CardDescription>
            </CardHeader>
            <CardContent className="h-64 sm:h-72">
              {d.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : porCategoria.length === 0 ? (
                <Vazio />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2}>
                      {porCategoria.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} formatter={(v) => <span className="text-xs">{v}</span>} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => fmtMZN(v, moeda)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
              <CardDescription>Quantidade no período</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {d.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : topProdutos.length === 0 ? (
                <Vazio />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProdutos} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={110} tickLine={false} axisLine={false} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(v: number, _n, p) => [`${fmtNum(v)} un · ${fmtMZN((p?.payload as { valor: number })?.valor ?? 0, moeda)}`, "Vendido"]}
                    />
                    <Bar dataKey="qtd" fill="var(--chart-1)" radius={[0, 5, 5, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                Baixa rotação
              </CardTitle>
              <CardDescription>Com stock e pouca saída</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : baixaRotacao.length === 0 ? (
                <Vazio />
              ) : (
                baixaRotacao.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">Stock {fmtNum(Number(p.estoque_atual))} {p.unidade}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{fmtNum(p.vendido)} vendidos</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas + Caixa/Finanças */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Atenção necessária
              </CardTitle>
              <CardDescription>Problemas que exigem decisão</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {d.isLoading ? (
                <Skeleton className="h-24 w-full sm:col-span-2" />
              ) : alertas.length === 0 ? (
                <div className="sm:col-span-2">
                  <Vazio texto="Sem problemas detectados" />
                </div>
              ) : (
                alertas.map((a) => (
                  <Link
                    key={a.id}
                    to={a.to}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/60 ${toneClasses[a.tone] ?? ""}`}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.detalhe}</p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Caixa e finanças</CardTitle>
              <CardDescription>{d.caixa.aberta ? "Sessão aberta" : "Nenhuma sessão aberta"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <>
                  <Linha label="Saldo estimado" valor={saldoCaixa === null ? "—" : fmtMZN(saldoCaixa, moeda)} forte />
                  <Linha label="Fundo de abertura" valor={d.caixa.aberta ? fmtMZN(Number(d.caixa.aberta.valor_abertura), moeda) : "—"} />
                  <Linha label="Entradas / reforços" valor={fmtMZN(entradasCaixa, moeda)} />
                  <Linha label="Saídas / sangrias" valor={fmtMZN(saidasCaixa, moeda)} />
                  <Separator className="my-2" />
                  {porMetodo.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem pagamentos no período.</p>
                  ) : (
                    porMetodo.map((m) => <Linha key={m.name} label={m.name} valor={fmtMZN(m.value, moeda)} />)
                  )}
                  {podeFinanceiro && (
                    <>
                      <Separator className="my-2" />
                      <Linha label="A receber" valor={fmtMZN(totalReceber, moeda)} />
                      <Linha label="A pagar" valor={fmtMZN(totalPagar, moeda)} />
                    </>
                  )}
                  {podeCaixa && (
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link to="/caixa">Abrir módulo de Caixa</Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Atividade recente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Atividade recente</CardTitle>
            <CardDescription>Vendas, compras, caixa e movimentos de stock</CardDescription>
          </CardHeader>
          <CardContent>
            {d.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : atividade.length === 0 ? (
              <Vazio texto={busca ? "Nada encontrado para a pesquisa" : "Sem dados disponíveis"} />
            ) : (
              <div className="divide-y">
                {atividade.map((a) => (
                  <Link key={a.id} to={a.to} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <a.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.desc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">{a.valor}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(a.quando).toLocaleString("pt-MZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function Linha({ label, valor, forte }: { label: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={`shrink-0 tabular-nums ${forte ? "text-base font-semibold" : "text-sm"}`}>{valor}</span>
    </div>
  );
}
