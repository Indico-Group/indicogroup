import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Receipt, RefreshCw, CheckCircle2, Lock, Unlock, Banknote, FileDown, Printer, Search,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/use-empresa";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { exportarCsv, registarAuditoria } from "@/lib/auditoria";
import {
  criarRelatorioPdf, criarReciboSalarialPdf, getEmpresaDoc, imprimirPdf, nomeFicheiro,
} from "@/lib/pdf";
import {
  FOLHA_STATUS, METODOS, formatMoeda, mesAtual, mesLabel, metodoLabel,
  type FolhaItem, type FolhaSalarial, type MetodoPagamento,
} from "@/lib/rh";

export const Route = createFileRoute("/_authenticated/folha-salarial")({
  head: () => ({
    meta: [
      { title: "Folha Salarial — Aldeia Mesa" },
      {
        name: "description",
        content:
          "Processamento da folha salarial mensal: cálculo com base de 30 dias, descontos por faltas, aprovação, fecho, pagamentos e recibos.",
      },
      { property: "og:title", content: "Folha Salarial — Aldeia Mesa" },
      {
        property: "og:description",
        content: "Gerar, aprovar, fechar e pagar a folha salarial mensal com recibos individuais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FolhaSalarialPage,
});

function FolhaSalarialPage() {
  const qc = useQueryClient();
  const { config: empresa } = useEmpresa();
  const moeda = empresa?.moeda ?? "MT";
  const { canDo } = usePermissions();
  const podeGerir = canDo("gerirRH");

  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState("");
  const [pagamento, setPagamento] = useState<FolhaItem | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>("dinheiro");
  const [referencia, setReferencia] = useState("");
  const [reabrir, setReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");

  const folhaQ = useQuery({
    queryKey: ["folha", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folhas_salariais")
        .select("*")
        .eq("mes", mes)
        .maybeSingle();
      if (error) throw error;
      return (data as FolhaSalarial | null) ?? null;
    },
  });
  const folha = folhaQ.data ?? null;

  const itensQ = useQuery({
    queryKey: ["folha-itens", folha?.id],
    enabled: !!folha?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_itens")
        .select("*")
        .eq("folha_id", folha!.id)
        .order("nome_funcionario");
      if (error) throw error;
      return (data ?? []) as FolhaItem[];
    },
  });
  const itens = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = itensQ.data ?? [];
    return t
      ? lista.filter((i) =>
          [i.nome_funcionario, i.codigo, i.cargo, i.departamento]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(t)),
        )
      : lista;
  }, [itensQ.data, busca]);

  const totais = useMemo(() => {
    const lista = itensQ.data ?? [];
    const soma = (f: (i: FolhaItem) => number) => lista.reduce((s, i) => s + Number(f(i) || 0), 0);
    const pagos = lista.filter((i) => i.status_pagamento === "pago");
    return {
      funcionarios: lista.length,
      base: soma((i) => i.salario_base),
      extras: soma((i) => i.valor_horas_extra),
      subsidios: soma((i) => Number(i.subsidios) + Number(i.bonus)),
      descontos: soma((i) => Number(i.desconto_faltas) + Number(i.adiantamentos) + Number(i.outros_descontos)),
      liquido: soma((i) => i.liquido),
      pagos: pagos.length,
      valorPago: pagos.reduce((s, i) => s + Number(i.liquido || 0), 0),
    };
  }, [itensQ.data]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["folha", mes] });
    qc.invalidateQueries({ queryKey: ["folha-itens"] });
    qc.invalidateQueries({ queryKey: ["rh-dashboard"] });
  };

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_folha", { p_mes: mes });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success(`Folha de ${mesLabel(mes)} gerada`);
      registarAuditoria({ modulo: "RH", acao: "gerar", entidade: "folhas_salariais", descricao: `Folha ${mes} gerada` });
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarEstado = useMutation({
    mutationFn: async ({ status, observacoes }: { status: FolhaSalarial["status"]; observacoes?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const patch = {
        status,
        ...(observacoes !== undefined ? { observacoes } : {}),
        ...(status === "aprovada"
          ? { aprovada_por: u.user?.id ?? null, aprovada_em: new Date().toISOString() }
          : {}),
        ...(status === "fechada"
          ? { fechada_por: u.user?.id ?? null, fechada_em: new Date().toISOString() }
          : {}),
      };
      const { error } = await supabase.from("folhas_salariais").update(patch).eq("id", folha!.id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(`Folha ${FOLHA_STATUS[status].label.toLowerCase()}`);
      registarAuditoria({
        modulo: "RH", acao: status, entidade: "folhas_salariais", entidade_id: folha?.id,
        descricao: `Folha ${mes} → ${status}`,
      });
      setReabrir(false);
      setMotivo("");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pagar = useMutation({
    mutationFn: async (item: FolhaItem) => {
      const agora = new Date().toISOString();
      const { data: lanc, error: e1 } = await supabase
        .from("financeiro_lancamentos")
        .insert({
          descricao: `Salário ${mesLabel(mes)} — ${item.nome_funcionario}`,
          tipo: "despesa",
          status: "pago",
          valor: Number(item.liquido),
          vencimento: agora.slice(0, 10),
          pago_em: agora,
          metodo,
          documento: referencia || null,
          observacoes: `Folha salarial ${mes}`,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("folha_itens")
        .update({
          status_pagamento: "pago",
          pago_em: agora,
          metodo_pagamento: metodo,
          referencia_pagamento: referencia || null,
          lancamento_id: lanc.id,
        })
        .eq("id", item.id);
      if (e2) throw e2;

      // Se todos pagos, marca a folha como paga
      const { data: pendentes } = await supabase
        .from("folha_itens")
        .select("id")
        .eq("folha_id", item.folha_id)
        .neq("status_pagamento", "pago");
      if (!pendentes || pendentes.length === 0) {
        await supabase.from("folhas_salariais").update({ status: "paga" }).eq("id", item.folha_id);
      }
      return item;
    },
    onSuccess: (item) => {
      toast.success(`Pagamento de ${item.nome_funcionario} registado`);
      registarAuditoria({
        modulo: "RH", acao: "pagar", entidade: "folha_itens", entidade_id: item.id,
        descricao: `Pagamento salário ${mes} — ${item.nome_funcionario}`,
        detalhes: { valor: item.liquido, metodo, referencia },
      });
      setPagamento(null);
      setReferencia("");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeEditar = folha?.status === "rascunho";

  /* ----------------------------------------------------------- exportar */

  const exportarPdf = async (imprimir = false) => {
    const empresa = await getEmpresaDoc();
    const doc = criarRelatorioPdf(empresa, {
      titulo: `Folha Salarial — ${mesLabel(mes)}`,
      subtitulo: `${totais.funcionarios} funcionários · estado: ${folha ? FOLHA_STATUS[folha.status].label : "—"}`,
      orientacao: "landscape",
      colunas: ["Funcionário", "Cargo", "Base", "Extras", "Subs./Bónus", "Faltas inj.", "Desc. faltas", "Adiant.", "Outros", "Líquido", "Pago"],
      linhas: itens.map((i) => [
        i.nome_funcionario,
        i.cargo ?? "—",
        formatMoeda(Number(i.salario_base), moeda),
        formatMoeda(Number(i.valor_horas_extra), moeda),
        formatMoeda(Number(i.subsidios) + Number(i.bonus), moeda),
        String(i.faltas_injustificadas),
        formatMoeda(Number(i.desconto_faltas), moeda),
        formatMoeda(Number(i.adiantamentos), moeda),
        formatMoeda(Number(i.outros_descontos), moeda),
        formatMoeda(Number(i.liquido), moeda),
        i.status_pagamento === "pago" ? "Sim" : "Não",
      ]),
      resumo: [
        { label: "Massa salarial", valor: formatMoeda(totais.base, moeda) },
        { label: "Descontos", valor: formatMoeda(totais.descontos, moeda) },
        { label: "Total líquido", valor: formatMoeda(totais.liquido, moeda) },
        { label: "Pago", valor: formatMoeda(totais.valorPago, moeda) },
      ],
    });
    if (imprimir) imprimirPdf(doc);
    else doc.save(nomeFicheiro(`folha-salarial-${mes}`));
    registarAuditoria({ modulo: "RH", acao: "exportar", entidade: "folhas_salariais", descricao: `Folha ${mes} em PDF` });
  };

  const exportarFolhaCsv = () => {
    exportarCsv(
      `folha-salarial-${mes}`,
      ["Funcionário", "Código", "Cargo", "Departamento", "Base", "Dias presentes", "Faltas injustificadas", "Horas extra", "Valor extras", "Subsídios", "Bónus", "Desconto faltas", "Adiantamentos", "Outros descontos", "Líquido", "Pagamento"],
      itens.map((i) => [
        i.nome_funcionario, i.codigo ?? "", i.cargo ?? "", i.departamento ?? "",
        Number(i.salario_base), i.dias_presentes, i.faltas_injustificadas, Number(i.horas_extra),
        Number(i.valor_horas_extra), Number(i.subsidios), Number(i.bonus), Number(i.desconto_faltas),
        Number(i.adiantamentos), Number(i.outros_descontos), Number(i.liquido),
        i.status_pagamento === "pago" ? metodoLabel(i.metodo_pagamento) : "Pendente",
      ]),
    );
    registarAuditoria({ modulo: "RH", acao: "exportar", entidade: "folhas_salariais", descricao: `Folha ${mes} em CSV` });
  };

  const recibo = async (i: FolhaItem) => {
    const empresa = await getEmpresaDoc();
    const doc = criarReciboSalarialPdf(empresa, {
      mes,
      nome: i.nome_funcionario,
      codigo: i.codigo,
      cargo: i.cargo,
      departamento: i.departamento,
      estabelecimento: i.estabelecimento,
      salario_base: Number(i.salario_base),
      valor_dia: Number(i.valor_dia),
      dias_presentes: i.dias_presentes,
      atrasos: i.atrasos,
      faltas_justificadas: i.faltas_justificadas,
      faltas_injustificadas: i.faltas_injustificadas,
      horas_extra: Number(i.horas_extra),
      valor_horas_extra: Number(i.valor_horas_extra),
      subsidios: Number(i.subsidios),
      bonus: Number(i.bonus),
      desconto_faltas: Number(i.desconto_faltas),
      adiantamentos: Number(i.adiantamentos),
      outros_descontos: Number(i.outros_descontos),
      liquido: Number(i.liquido),
      status_pagamento: i.status_pagamento,
      pago_em: i.pago_em,
      metodo_pagamento: i.metodo_pagamento,
      referencia_pagamento: i.referencia_pagamento,
    });
    doc.save(nomeFicheiro(`recibo-${i.nome_funcionario}-${mes}`));
  };

  /* --------------------------------------------------------------- UI */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Folha Salarial"
        description="Cálculo com base fixa de 30 dias, descontos automáticos por faltas injustificadas e pagamento integrado ao financeiro."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportarFolhaCsv()} disabled={!itens.length}>
              <FileDown className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPdf(false)} disabled={!itens.length}>
              <FileDown className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPdf(true)} disabled={!itens.length}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Label htmlFor="mes">Mês de referência</Label>
            <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="relative w-full flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Procurar funcionário…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {podeGerir && (!folha || podeEditar) && (
              <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${gerar.isPending ? "animate-spin" : ""}`} />
                {folha ? "Recalcular" : "Gerar folha"}
              </Button>
            )}
            {podeGerir && folha?.status === "rascunho" && (
              <Button variant="secondary" onClick={() => mudarEstado.mutate({ status: "aprovada" })}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
              </Button>
            )}
            {podeGerir && folha?.status === "aprovada" && (
              <Button variant="secondary" onClick={() => mudarEstado.mutate({ status: "fechada" })}>
                <Lock className="mr-1.5 h-4 w-4" /> Fechar
              </Button>
            )}
            {podeGerir && (folha?.status === "fechada" || folha?.status === "paga") && (
              <Button variant="outline" onClick={() => setReabrir(true)}>
                <Unlock className="mr-1.5 h-4 w-4" /> Reabrir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {folhaQ.isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      ) : !folha ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ainda não existe folha para {mesLabel(mes)}.
            </p>
            {podeGerir && (
              <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>
                Gerar folha de {mesLabel(mes)}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo titulo="Funcionários" valor={String(totais.funcionarios)} />
            <Resumo titulo="Massa salarial" valor={formatMoeda(totais.base, moeda)} />
            <Resumo titulo="Descontos" valor={formatMoeda(totais.descontos, moeda)} tom="negativo" />
            <Resumo titulo="Total líquido" valor={formatMoeda(totais.liquido, moeda)} tom="positivo" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">
                Folha de {mesLabel(mes)}{" "}
                <Badge className={`ml-2 ${FOLHA_STATUS[folha.status].className}`}>
                  {FOLHA_STATUS[folha.status].label}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {totais.pagos}/{totais.funcionarios} pagos · {formatMoeda(totais.valorPago, moeda)}
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Extras</TableHead>
                    <TableHead className="text-right">Subs./Bónus</TableHead>
                    <TableHead className="text-right">F. inj.</TableHead>
                    <TableHead className="text-right">Desc. faltas</TableHead>
                    <TableHead className="text-right">Adiant.</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        Sem dados disponíveis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p className="font-medium">{i.nome_funcionario}</p>
                          <p className="text-xs text-muted-foreground">
                            {[i.cargo, i.departamento].filter(Boolean).join(" · ") || "—"} ·{" "}
                            {i.dias_presentes} dias
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{formatMoeda(Number(i.salario_base), moeda)}</TableCell>
                        <TableCell className="text-right">{formatMoeda(Number(i.valor_horas_extra), moeda)}</TableCell>
                        <TableCell className="text-right">
                          {formatMoeda(Number(i.subsidios) + Number(i.bonus), moeda)}
                        </TableCell>
                        <TableCell className="text-right">{i.faltas_injustificadas}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatMoeda(Number(i.desconto_faltas), moeda)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatMoeda(Number(i.adiantamentos), moeda)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoeda(Number(i.liquido), moeda)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => recibo(i)} title="Recibo">
                              <Receipt className="h-4 w-4" />
                            </Button>
                            {i.status_pagamento === "pago" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                {metodoLabel(i.metodo_pagamento)}
                              </Badge>
                            ) : (
                              podeGerir &&
                              (folha.status === "fechada" || folha.status === "aprovada" || folha.status === "paga") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPagamento(i);
                                    setMetodo((i.metodo_pagamento as MetodoPagamento) ?? "dinheiro");
                                  }}
                                >
                                  <Banknote className="mr-1 h-4 w-4" /> Pagar
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* pagamento */}
      <Dialog open={!!pagamento} onOpenChange={(o) => !o && setPagamento(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registar pagamento</DialogTitle>
            <DialogDescription>
              {pagamento?.nome_funcionario} — {formatMoeda(Number(pagamento?.liquido ?? 0), moeda)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Método</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoPagamento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ref">Referência (opcional)</Label>
              <Input id="ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagamento(null)}>
              Cancelar
            </Button>
            <Button onClick={() => pagamento && pagar.mutate(pagamento)} disabled={pagar.isPending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* reabertura */}
      <Dialog open={reabrir} onOpenChange={setReabrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir folha</DialogTitle>
            <DialogDescription>
              Indique o motivo da reabertura — fica registado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da reabertura" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrir(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() =>
                mudarEstado.mutate({
                  status: "rascunho",
                  observacoes: `Reaberta em ${new Date().toLocaleString("pt-PT")}: ${motivo.trim()}`,
                })
              }
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({ titulo, valor, tom }: { titulo: string; valor: string; tom?: "positivo" | "negativo" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            tom === "positivo" ? "text-emerald-600 dark:text-emerald-400" : tom === "negativo" ? "text-destructive" : ""
          }`}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
