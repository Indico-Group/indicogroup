import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3, FileDown, Printer, Package, Wallet, Users, ShoppingBag,
  Truck, ArrowLeftRight, Trophy, BadgeDollarSign, Eye, FileSpreadsheet, FileText,
} from "lucide-react";

import { toast } from "sonner";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getEmpresaDoc, criarRelatorioPdf, imprimirPdf, nomeFicheiro, moeda, type RelatorioOpts,
} from "@/lib/pdf";
import { exportarCsv, exportarXlsx } from "@/lib/exportar";


export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Aldeia Mesa" },
      { name: "description", content: "Relatórios de vendas, produtos vendidos, estoque, compras, caixa, clientes e salários em PDF, com pré-visualização e impressão directa." },
      { property: "og:title", content: "Relatórios — Aldeia Mesa" },
      { property: "og:description", content: "Gere, pré-visualize e imprima relatórios do bar e restaurante com o logotipo e dados da empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelatoriosPage,
});

type Tipo =
  | "vendas" | "itens" | "produtos" | "movimentos"
  | "compras" | "caixa" | "clientes" | "salarios";

const cur = "MZN";

function hoje() {
  return format(new Date(), "yyyy-MM-dd");
}

function RelatoriosPage() {
  const [inicio, setInicio] = useState(format(new Date(Date.now() - 29 * 864e5), "yyyy-MM-dd"));
  const [fim, setFim] = useState(hoje());
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<RelatorioOpts | null>(null);

  const build = async (tipo: Tipo): Promise<RelatorioOpts> => {
    const de = new Date(`${inicio}T00:00:00`).toISOString();
    const ate = new Date(`${fim}T23:59:59`).toISOString();
    const periodo = `Período: ${format(new Date(inicio), "dd/MM/yyyy")} a ${format(new Date(fim), "dd/MM/yyyy")}`;

    if (tipo === "vendas") {
      const { data, error } = await supabase
        .from("vendas").select("*").gte("created_at", de).lte("created_at", ate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const pagas = rows.filter((v) => v.status === "paga");
      const receita = pagas.reduce((s, v) => s + Number(v.total), 0);
      return {
        titulo: "Relatório de Vendas",
        subtitulo: periodo,
        colunas: ["Nº", "Data", "Tipo", "Pagamento", "Estado", "Total"],
        linhas: rows.map((v) => [
          `#${v.numero}`,
          format(new Date(v.created_at), "dd/MM/yyyy HH:mm"),
          v.tipo,
          v.metodo_pagamento ?? "-",
          v.status,
          moeda(Number(v.total), cur),
        ]),
        resumo: [
          { label: "Vendas pagas", valor: String(pagas.length) },
          { label: "Receita total", valor: moeda(receita, cur) },
          { label: "Ticket médio", valor: moeda(pagas.length ? receita / pagas.length : 0, cur) },
          { label: "Descontos concedidos", valor: moeda(pagas.reduce((s, v) => s + Number(v.desconto ?? 0), 0), cur) },
          { label: "Canceladas", valor: String(rows.filter((v) => v.status === "cancelada").length) },
        ],
      };
    }

    if (tipo === "itens") {
      const { data: vendas, error: e1 } = await supabase
        .from("vendas").select("id").eq("status", "paga").gte("created_at", de).lte("created_at", ate);
      if (e1) throw e1;
      const ids = (vendas ?? []).map((v) => v.id);
      let itens: { nome_produto: string; quantidade: number; subtotal: number }[] = [];
      if (ids.length) {
        const { data, error } = await supabase
          .from("venda_itens").select("nome_produto, quantidade, subtotal").in("venda_id", ids);
        if (error) throw error;
        itens = (data ?? []).map((i) => ({
          nome_produto: i.nome_produto,
          quantidade: Number(i.quantidade),
          subtotal: Number(i.subtotal),
        }));
      }
      const mapa = new Map<string, { qtd: number; total: number }>();
      for (const i of itens) {
        const a = mapa.get(i.nome_produto) ?? { qtd: 0, total: 0 };
        mapa.set(i.nome_produto, { qtd: a.qtd + i.quantidade, total: a.total + i.subtotal });
      }
      const rows = [...mapa.entries()].sort((a, b) => b[1].total - a[1].total);
      const totalGeral = rows.reduce((s, [, v]) => s + v.total, 0);
      return {
        titulo: "Produtos Mais Vendidos",
        subtitulo: periodo,
        colunas: ["#", "Produto", "Quantidade", "Receita", "% da receita"],
        linhas: rows.map(([nome, v], i) => [
          String(i + 1),
          nome,
          String(v.qtd),
          moeda(v.total, cur),
          `${totalGeral ? ((v.total / totalGeral) * 100).toFixed(1) : "0.0"}%`,
        ]),
        resumo: [
          { label: "Produtos distintos", valor: String(rows.length) },
          { label: "Unidades vendidas", valor: String(rows.reduce((s, [, v]) => s + v.qtd, 0)) },
          { label: "Receita dos itens", valor: moeda(totalGeral, cur) },
        ],
      };
    }

    if (tipo === "produtos") {
      const { data, error } = await supabase
        .from("produtos").select("nome, codigo, preco_compra, preco_venda, estoque_atual, estoque_minimo, unidade, is_active")
        .order("nome");
      if (error) throw error;
      const rows = data ?? [];
      const valorStock = rows.reduce((s, p) => s + Number(p.estoque_atual) * Number(p.preco_compra), 0);
      const valorVenda = rows.reduce((s, p) => s + Number(p.estoque_atual) * Number(p.preco_venda), 0);
      return {
        titulo: "Relatório de Produtos e Estoque",
        subtitulo: `Posição em ${format(new Date(), "dd/MM/yyyy")}`,
        orientacao: "landscape",
        colunas: ["Produto", "Código", "P. Compra", "P. Venda", "Estoque", "Mínimo", "Un.", "Estado"],
        linhas: rows.map((p) => [
          p.nome,
          p.codigo ?? "-",
          moeda(Number(p.preco_compra), cur),
          moeda(Number(p.preco_venda), cur),
          String(p.estoque_atual),
          String(p.estoque_minimo),
          p.unidade,
          p.is_active ? "Activo" : "Inactivo",
        ]),
        resumo: [
          { label: "Produtos", valor: String(rows.length) },
          { label: "Abaixo do mínimo", valor: String(rows.filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo)).length) },
          { label: "Valor do estoque (a custo)", valor: moeda(valorStock, cur) },
          { label: "Valor potencial de venda", valor: moeda(valorVenda, cur) },
        ],
      };
    }

    if (tipo === "movimentos") {
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("created_at, tipo, quantidade, estoque_anterior, estoque_novo, motivo, produtos(nome)")
        .gte("created_at", de).lte("created_at", ate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        created_at: string; tipo: string; quantidade: number;
        estoque_anterior: number; estoque_novo: number; motivo: string | null;
        produtos: { nome: string } | null;
      }[];
      const entradas = rows.filter((m) => m.tipo === "compra" || m.tipo === "transferencia_entrada");
      const saidas = rows.filter((m) => m.tipo === "venda" || m.tipo === "transferencia_saida");
      return {
        titulo: "Movimentos de Estoque",
        subtitulo: periodo,
        orientacao: "landscape",
        colunas: ["Data", "Produto", "Tipo", "Qtd.", "Anterior", "Novo", "Motivo"],
        linhas: rows.map((m) => [
          format(new Date(m.created_at), "dd/MM/yyyy HH:mm"),
          m.produtos?.nome ?? "-",
          m.tipo,
          String(m.quantidade),
          String(m.estoque_anterior),
          String(m.estoque_novo),
          m.motivo ?? "-",
        ]),
        resumo: [
          { label: "Movimentos", valor: String(rows.length) },
          { label: "Entradas", valor: String(entradas.reduce((s, m) => s + Number(m.quantidade), 0)) },
          { label: "Saídas", valor: String(saidas.reduce((s, m) => s + Number(m.quantidade), 0)) },
        ],
      };
    }

    if (tipo === "compras") {
      const { data, error } = await supabase
        .from("compras").select("*, fornecedores(nome)")
        .gte("created_at", de).lte("created_at", ate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        numero: number; created_at: string; status: string; total: number; desconto: number;
        documento: string | null; fornecedores: { nome: string } | null;
      }[];
      const recebidas = rows.filter((c) => c.status === "recebida");
      return {
        titulo: "Relatório de Compras",
        subtitulo: periodo,
        orientacao: "landscape",
        colunas: ["Nº", "Data", "Fornecedor", "Documento", "Estado", "Desconto", "Total"],
        linhas: rows.map((c) => [
          `#${c.numero}`,
          format(new Date(c.created_at), "dd/MM/yyyy"),
          c.fornecedores?.nome ?? "-",
          c.documento ?? "-",
          c.status,
          moeda(Number(c.desconto ?? 0), cur),
          moeda(Number(c.total), cur),
        ]),
        resumo: [
          { label: "Ordens de compra", valor: String(rows.length) },
          { label: "Recebidas", valor: String(recebidas.length) },
          { label: "Total recebido", valor: moeda(recebidas.reduce((s, c) => s + Number(c.total), 0), cur) },
          { label: "Pendentes", valor: String(rows.filter((c) => c.status === "pendente").length) },
        ],
      };
    }

    if (tipo === "caixa") {
      const { data, error } = await supabase
        .from("caixa_sessoes").select("*").gte("aberta_em", de).lte("aberta_em", ate)
        .order("aberta_em", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      return {
        titulo: "Relatório de Caixa",
        subtitulo: periodo,
        colunas: ["Abertura", "Fecho", "Estado", "Fundo", "Esperado", "Contado", "Diferença"],
        linhas: rows.map((s) => [
          format(new Date(s.aberta_em), "dd/MM/yyyy HH:mm"),
          s.fechada_em ? format(new Date(s.fechada_em), "dd/MM/yyyy HH:mm") : "-",
          s.status,
          moeda(Number(s.valor_abertura), cur),
          s.valor_esperado != null ? moeda(Number(s.valor_esperado), cur) : "-",
          s.valor_fechamento != null ? moeda(Number(s.valor_fechamento), cur) : "-",
          s.diferenca != null ? moeda(Number(s.diferenca), cur) : "-",
        ]),
        resumo: [
          { label: "Sessões", valor: String(rows.length) },
          { label: "Abertas", valor: String(rows.filter((r) => r.status === "aberta").length) },
          { label: "Diferença acumulada", valor: moeda(rows.reduce((s, r) => s + Number(r.diferenca ?? 0), 0), cur) },
        ],
      };
    }

    if (tipo === "salarios") {
      const { data: funcs, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, salario_base, subsidios, desconto_percent, valor_hora_extra")
        .eq("is_active", true).order("nome");
      if (error) throw error;
      const mes = new Date(`${fim}T00:00:00`);
      const ini = new Date(mes.getFullYear(), mes.getMonth(), 1);
      const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
      const { data: pres, error: e2 } = await supabase
        .from("presencas").select("funcionario_id, estado, horas_extra")
        .gte("data", format(ini, "yyyy-MM-dd"))
        .lte("data", format(new Date(mes.getFullYear(), mes.getMonth(), dias), "yyyy-MM-dd"));
      if (e2) throw e2;
      const porFunc = new Map<string, { faltas: number; extra: number }>();
      for (const p of pres ?? []) {
        const a = porFunc.get(p.funcionario_id) ?? { faltas: 0, extra: 0 };
        if (p.estado === "falta") a.faltas += 1;
        a.extra += Number(p.horas_extra ?? 0);
        porFunc.set(p.funcionario_id, a);
      }
      const linhas: (string | number)[][] = [];
      let totalLiquido = 0;
      for (const f of funcs ?? []) {
        const a = porFunc.get(f.id) ?? { faltas: 0, extra: 0 };
        const base = Number(f.salario_base);
        const descFaltas = (base / dias) * a.faltas;
        const extra = a.extra * Number(f.valor_hora_extra);
        const bruto = base + Number(f.subsidios) + extra;
        const descPerc = (bruto * Number(f.desconto_percent)) / 100;
        const liquido = bruto - descFaltas - descPerc;
        totalLiquido += liquido;
        linhas.push([
          f.nome, f.cargo ?? "-", moeda(base, cur), moeda(Number(f.subsidios), cur),
          String(a.faltas), moeda(descFaltas, cur), moeda(extra, cur),
          moeda(descPerc, cur), moeda(liquido, cur),
        ]);
      }
      return {
        titulo: "Folha Salarial",
        subtitulo: `Mês de ${format(mes, "MM/yyyy")}`,
        orientacao: "landscape",
        colunas: ["Funcionário", "Cargo", "Base", "Subsídios", "Faltas", "Desc. faltas", "Horas extra", "Descontos", "Líquido"],
        linhas,
        resumo: [
          { label: "Funcionários activos", valor: String(linhas.length) },
          { label: "Total líquido a pagar", valor: moeda(totalLiquido, cur) },
        ],
      };
    }

    const { data, error } = await supabase
      .from("clientes").select("nome, telefone, email, nif, is_active").order("nome");
    if (error) throw error;
    const rows = data ?? [];
    return {
      titulo: "Relatório de Clientes",
      subtitulo: `${rows.length} cliente(s) registado(s)`,
      colunas: ["Nome", "Telefone", "Email", "NUIT", "Estado"],
      linhas: rows.map((c) => [c.nome, c.telefone ?? "-", c.email ?? "-", c.nif ?? "-", c.is_active ? "Activo" : "Inactivo"]),
      resumo: [
        { label: "Clientes", valor: String(rows.length) },
        { label: "Activos", valor: String(rows.filter((c) => c.is_active).length) },
      ],
    };
  };

  const run = async (tipo: Tipo, acao: "pdf" | "print" | "ver" | "csv" | "xlsx") => {
    setBusy(`${tipo}-${acao}`);
    try {
      if (acao === "ver") {
        setPreview(await build(tipo));
        return;
      }
      if (acao === "csv" || acao === "xlsx") {
        const opts = await build(tipo);
        if (acao === "csv") exportarCsv(opts);
        else exportarXlsx(opts);
        toast.success(`${opts.titulo} exportado em ${acao.toUpperCase()}`);
        return;
      }
      const [empresa, opts] = await Promise.all([getEmpresaDoc(), build(tipo)]);
      const doc = criarRelatorioPdf(empresa, opts);
      if (acao === "print") imprimirPdf(doc);
      else doc.save(nomeFicheiro(opts.titulo));
    } catch (e) {
      toast.error((e as Error).message || "Falha ao gerar o relatório");
    } finally {
      setBusy(null);
    }
  };

  const exportarPreview = async (acao: "pdf" | "print" | "csv" | "xlsx") => {
    if (!preview) return;
    try {
      if (acao === "csv") return exportarCsv(preview);
      if (acao === "xlsx") return exportarXlsx(preview);
      const empresa = await getEmpresaDoc();
      const doc = criarRelatorioPdf(empresa, preview);
      if (acao === "print") imprimirPdf(doc);
      else doc.save(nomeFicheiro(preview.titulo));
    } catch (e) {
      toast.error((e as Error).message || "Falha ao gerar o relatório");
    }
  };


  const cards: { tipo: Tipo; titulo: string; desc: string; Icon: typeof BarChart3; usaPeriodo: boolean }[] = [
    { tipo: "vendas", titulo: "Vendas", desc: "Vendas do período com receita, ticket médio, estados e métodos de pagamento.", Icon: ShoppingBag, usaPeriodo: true },
    { tipo: "itens", titulo: "Produtos Mais Vendidos", desc: "Ranking por receita e quantidade vendida no período.", Icon: Trophy, usaPeriodo: true },
    { tipo: "produtos", titulo: "Produtos e Estoque", desc: "Posição actual do estoque, preços, valor a custo e alertas de mínimo.", Icon: Package, usaPeriodo: false },
    { tipo: "movimentos", titulo: "Movimentos de Estoque", desc: "Entradas, saídas, ajustes e transferências com motivo.", Icon: ArrowLeftRight, usaPeriodo: true },
    { tipo: "compras", titulo: "Compras", desc: "Ordens de compra por fornecedor, estados e totais recebidos.", Icon: Truck, usaPeriodo: true },
    { tipo: "caixa", titulo: "Caixa", desc: "Sessões de caixa, valores esperados, contados e diferenças.", Icon: Wallet, usaPeriodo: true },
    { tipo: "salarios", titulo: "Folha Salarial", desc: "Salários do mês da data final, com faltas, horas extra e líquido.", Icon: BadgeDollarSign, usaPeriodo: true },
    { tipo: "clientes", titulo: "Clientes", desc: "Base de clientes com contactos e estado.", Icon: Users, usaPeriodo: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Gere, pré-visualize e imprima PDFs com o logotipo e os dados da empresa" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>Aplicado aos relatórios marcados com “período”.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setInicio(hoje()); setFim(hoje()); }}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => { setInicio(format(new Date(Date.now() - 6 * 864e5), "yyyy-MM-dd")); setFim(hoje()); }}>7 dias</Button>
            <Button variant="outline" size="sm" onClick={() => { setInicio(format(new Date(Date.now() - 29 * 864e5), "yyyy-MM-dd")); setFim(hoje()); }}>30 dias</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ tipo, titulo, desc, Icon, usaPeriodo }) => (
          <Card key={tipo}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <CardTitle className="text-base">{titulo}</CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="mt-1 font-normal">
                      {usaPeriodo ? "Usa o período seleccionado" : "Posição actual"}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{desc}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run(tipo, "ver")}>
                  <Eye className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-ver` ? "A carregar..." : "Pré-visualizar"}
                </Button>
                <Button size="sm" disabled={busy !== null} onClick={() => run(tipo, "pdf")}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-pdf` ? "A gerar..." : "Exportar PDF"}
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(tipo, "xlsx")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-xlsx` ? "A gerar..." : "Excel"}
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(tipo, "csv")}>
                  <FileText className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-csv` ? "A gerar..." : "CSV"}
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(tipo, "print")}>
                  <Printer className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-print` ? "A preparar..." : "Imprimir"}
                </Button>

              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.titulo}</DialogTitle>
            <DialogDescription>{preview?.subtitulo}</DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              <ScrollArea className="h-[50vh] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.colunas.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.linhas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={preview.colunas.length} className="h-24 text-center text-muted-foreground">
                          Sem dados no período seleccionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      preview.linhas.map((linha, i) => (
                        <TableRow key={i}>
                          {linha.map((c, j) => (
                            <TableCell key={j} className="whitespace-nowrap text-sm">{String(c)}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {preview.resumo?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {preview.resumo.map((r) => (
                    <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-semibold">{r.valor}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => exportarPreview("csv")}>
                  <FileText className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" onClick={() => exportarPreview("xlsx")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" onClick={() => exportarPreview("print")}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button onClick={() => exportarPreview("pdf")}>
                  <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
