import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, AlarmClock, XCircle, Clock3, Banknote, TrendingDown,
  Wallet, AlertTriangle, RefreshCw,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/use-empresa";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FOLHA_STATUS, estadoInfo, fimMes, formatMoeda, inicioMes, isFaltaInjustificada,
  mesAtual, mesLabel, type Adiantamento, type FolhaItem, type FolhaSalarial,
  type Funcionario, type Presenca,
} from "@/lib/rh";

export const Route = createFileRoute("/_authenticated/rh")({
  head: () => ({
    meta: [
      { title: "Dashboard RH — Aldeia Mesa" },
      {
        name: "description",
        content:
          "Painel de recursos humanos: efectivos, assiduidade, faltas injustificadas, horas extras, massa salarial e estado dos pagamentos.",
      },
      { property: "og:title", content: "Dashboard RH — Aldeia Mesa" },
      {
        property: "og:description",
        content: "Indicadores de pessoal, assiduidade e folha salarial em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardRhPage,
});

const TODOS = "__todos__";

function DashboardRhPage() {
  const { moeda } = useEmpresa();
  const [mes, setMes] = useState(mesAtual());
  const [funcionarioId, setFuncionarioId] = useState(TODOS);
  const [departamento, setDepartamento] = useState(TODOS);
  const [estabelecimento, setEstabelecimento] = useState(TODOS);

  const q = useQuery({
    queryKey: ["rh-dashboard", mes],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [f, p, fo, ad] = await Promise.all([
        supabase.from("funcionarios").select("*").order("nome"),
        supabase.from("presencas").select("*").gte("data", inicioMes(mes)).lte("data", fimMes(mes)),
        supabase.from("folhas_salariais").select("*").eq("mes", mes).maybeSingle(),
        supabase.from("adiantamentos").select("*").eq("mes_referencia", mes),
      ]);
      if (f.error) throw f.error;
      if (p.error) throw p.error;
      if (ad.error) throw ad.error;
      const folha = (fo.data as FolhaSalarial | null) ?? null;
      let itens: FolhaItem[] = [];
      if (folha) {
        const { data } = await supabase.from("folha_itens").select("*").eq("folha_id", folha.id);
        itens = (data ?? []) as FolhaItem[];
      }
      return {
        funcionarios: (f.data ?? []) as Funcionario[],
        presencas: (p.data ?? []) as Presenca[],
        adiantamentos: (ad.data ?? []) as Adiantamento[],
        folha,
        itens,
      };
    },
  });

  const d = q.data;

  const departamentos = useMemo(
    () => Array.from(new Set((d?.funcionarios ?? []).map((f) => f.departamento).filter(Boolean) as string[])).sort(),
    [d],
  );
  const estabelecimentos = useMemo(
    () => Array.from(new Set((d?.funcionarios ?? []).map((f) => f.estabelecimento).filter(Boolean) as string[])).sort(),
    [d],
  );

  const filtrados = useMemo(() => {
    let lista = d?.funcionarios ?? [];
    if (funcionarioId !== TODOS) lista = lista.filter((f) => f.id === funcionarioId);
    if (departamento !== TODOS) lista = lista.filter((f) => f.departamento === departamento);
    if (estabelecimento !== TODOS) lista = lista.filter((f) => f.estabelecimento === estabelecimento);
    return lista;
  }, [d, funcionarioId, departamento, estabelecimento]);

  const ids = useMemo(() => new Set(filtrados.map((f) => f.id)), [filtrados]);

  const kpis = useMemo(() => {
    const presencas = (d?.presencas ?? []).filter((p) => ids.has(p.funcionario_id));
    const itens = (d?.itens ?? []).filter((i) => ids.has(i.funcionario_id));
    const adiant = (d?.adiantamentos ?? []).filter((a) => ids.has(a.funcionario_id));
    const activos = filtrados.filter((f) => f.is_active);
    const pagos = itens.filter((i) => i.status_pagamento === "pago");
    return {
      total: filtrados.length,
      activos: activos.length,
      faltasInj: presencas.filter(isFaltaInjustificada).length,
      atrasos: presencas.filter((p) => p.estado === "atraso").length,
      horasExtra: presencas.reduce((s, p) => s + Number(p.horas_extra || 0), 0),
      massa: activos.reduce((s, f) => s + Number(f.salario_base || 0), 0),
      adiantamentos: adiant.reduce((s, a) => s + Number(a.valor || 0), 0),
      descontos: itens.reduce(
        (s, i) => s + Number(i.desconto_faltas || 0) + Number(i.adiantamentos || 0) + Number(i.outros_descontos || 0),
        0,
      ),
      liquido: itens.reduce((s, i) => s + Number(i.liquido || 0), 0),
      pagos: pagos.length,
      valorPago: pagos.reduce((s, i) => s + Number(i.liquido || 0), 0),
      pendentes: itens.length - pagos.length,
      itens,
      presencas,
    };
  }, [d, filtrados, ids]);

  const alertas = useMemo(() => {
    const a: { texto: string; tom: "aviso" | "erro" }[] = [];
    if (!d) return a;
    if (!d.folha) a.push({ texto: `Folha de ${mesLabel(mes)} ainda não foi gerada`, tom: "aviso" });
    if (d.folha && d.folha.status === "rascunho") a.push({ texto: "Folha em rascunho — falta aprovar", tom: "aviso" });
    if (kpis.pendentes > 0) a.push({ texto: `${kpis.pendentes} salários por pagar`, tom: "aviso" });
    const porJustificar = kpis.presencas.filter(
      (p) => p.estado === "falta" && (p.justificacao ?? "") !== "" && (p.justificacao_estado ?? "pendente") === "pendente",
    ).length;
    if (porJustificar) a.push({ texto: `${porJustificar} justificações por avaliar`, tom: "aviso" });
    if (kpis.faltasInj > 0) a.push({ texto: `${kpis.faltasInj} faltas injustificadas no mês`, tom: "erro" });
    const semSalario = filtrados.filter((f) => f.is_active && Number(f.salario_base || 0) <= 0).length;
    if (semSalario) a.push({ texto: `${semSalario} funcionários activos sem salário definido`, tom: "erro" });
    return a;
  }, [d, kpis, filtrados, mes]);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-sm text-destructive">Não foi possível carregar os dados de RH.</p>
          <Button variant="outline" className="mt-3" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard RH"
        description="Indicadores de pessoal, assiduidade e folha salarial com dados reais do período seleccionado."
        actions={
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="mes">Mês</Label>
            <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div>
            <Label>Funcionário</Label>
            <Select value={funcionarioId} onValueChange={setFuncionarioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {(d?.funcionarios ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Departamento</Label>
            <Select value={departamento} onValueChange={setDepartamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {departamentos.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estabelecimento</Label>
            <Select value={estabelecimento} onValueChange={setEstabelecimento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {estabelecimentos.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} titulo="Funcionários" valor={String(kpis.total)} />
        <Kpi icon={UserCheck} titulo="Activos" valor={String(kpis.activos)} tom="positivo" />
        <Kpi icon={XCircle} titulo="Faltas injustificadas" valor={String(kpis.faltasInj)} tom={kpis.faltasInj ? "negativo" : undefined} />
        <Kpi icon={AlarmClock} titulo="Atrasos" valor={String(kpis.atrasos)} tom={kpis.atrasos ? "aviso" : undefined} />
        <Kpi icon={Clock3} titulo="Horas extra" valor={`${kpis.horasExtra.toFixed(1)} h`} />
        <Kpi icon={Banknote} titulo="Massa salarial" valor={formatMoeda(kpis.massa, moeda)} />
        <Kpi icon={TrendingDown} titulo="Descontos" valor={formatMoeda(kpis.descontos, moeda)} tom={kpis.descontos ? "negativo" : undefined} />
        <Kpi icon={Wallet} titulo="Líquido a pagar" valor={formatMoeda(kpis.liquido - kpis.valorPago, moeda)} tom="positivo" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              Folha de {mesLabel(mes)}
              {d?.folha && (
                <Badge className={`ml-2 ${FOLHA_STATUS[d.folha.status].className}`}>
                  {FOLHA_STATUS[d.folha.status].label}
                </Badge>
              )}
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/folha-salarial">Abrir folha</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {kpis.itens.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem dados disponíveis.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">F. inj.</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nome_funcionario}</TableCell>
                      <TableCell className="text-right">{i.faltas_injustificadas}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatMoeda(
                          Number(i.desconto_faltas) + Number(i.adiantamentos) + Number(i.outros_descontos),
                          moeda,
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatMoeda(Number(i.liquido), moeda)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={
                            i.status_pagamento === "pago"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }
                        >
                          {i.status_pagamento === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Atenção necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem alertas.</p>
            ) : (
              alertas.map((a, idx) => (
                <div
                  key={idx}
                  className={`rounded-md px-3 py-2 text-sm ${
                    a.tom === "erro"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {a.texto}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Assiduidade recente</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/funcionarios">Gerir assiduidade</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {kpis.presencas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem registos neste período.</p>
          ) : (
            [...kpis.presencas]
              .sort((a, b) => (a.data < b.data ? 1 : -1))
              .slice(0, 10)
              .map((p) => {
                const info = estadoInfo(p.estado);
                const nome = d?.funcionarios.find((f) => f.id === p.funcionario_id)?.nome ?? "—";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nome}</p>
                      <p className="text-xs text-muted-foreground">{p.data.split("-").reverse().join("/")}</p>
                    </div>
                    <Badge className={info.className}>{info.label}</Badge>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  titulo,
  valor,
  tom,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  valor: string;
  tom?: "positivo" | "negativo" | "aviso";
}) {
  const cor =
    tom === "positivo"
      ? "text-emerald-600 dark:text-emerald-400"
      : tom === "negativo"
        ? "text-destructive"
        : tom === "aviso"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 pt-6">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className={`mt-1 text-xl font-semibold ${cor}`}>{valor}</p>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
