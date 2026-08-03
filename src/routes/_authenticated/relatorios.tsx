import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, FileDown, Printer, Package, Wallet, Users, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getEmpresaDoc, criarRelatorioPdf, imprimirPdf, nomeFicheiro, moeda, type RelatorioOpts,
} from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Aldeia Mesa" },
      { name: "description", content: "Relatórios de vendas, estoque, caixa e clientes em PDF, com impressão directa." },
      { property: "og:title", content: "Relatórios — Aldeia Mesa" },
      { property: "og:description", content: "Gere e imprima relatórios do bar e restaurante com o logotipo e dados da empresa." },
    ],
  }),
  component: RelatoriosPage,
});

type Tipo = "vendas" | "produtos" | "caixa" | "clientes";

function hoje() {
  return format(new Date(), "yyyy-MM-dd");
}

function RelatoriosPage() {
  const [inicio, setInicio] = useState(format(new Date(Date.now() - 29 * 864e5), "yyyy-MM-dd"));
  const [fim, setFim] = useState(hoje());
  const [busy, setBusy] = useState<string | null>(null);

  const build = async (tipo: Tipo): Promise<RelatorioOpts> => {
    const de = new Date(`${inicio}T00:00:00`).toISOString();
    const ate = new Date(`${fim}T23:59:59`).toISOString();
    const periodo = `Período: ${format(new Date(inicio), "dd/MM/yyyy")} a ${format(new Date(fim), "dd/MM/yyyy")}`;
    const cur = "MZN";

    if (tipo === "vendas") {
      const { data, error } = await supabase
        .from("vendas").select("*").gte("created_at", de).lte("created_at", ate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const pagas = rows.filter((v) => v.status === "paga");
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
          { label: "Receita total", valor: moeda(pagas.reduce((s, v) => s + Number(v.total), 0), cur) },
          { label: "Canceladas", valor: String(rows.filter((v) => v.status === "cancelada").length) },
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
          { label: "Diferença acumulada", valor: moeda(rows.reduce((s, r) => s + Number(r.diferenca ?? 0), 0), cur) },
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
    };
  };

  const run = async (tipo: Tipo, acao: "pdf" | "print") => {
    setBusy(`${tipo}-${acao}`);
    try {
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

  const cards: { tipo: Tipo; titulo: string; desc: string; Icon: typeof BarChart3; usaPeriodo: boolean }[] = [
    { tipo: "vendas", titulo: "Vendas", desc: "Vendas do período com receita, estados e métodos de pagamento.", Icon: ShoppingBag, usaPeriodo: true },
    { tipo: "produtos", titulo: "Produtos e Estoque", desc: "Posição actual do estoque, preços e alertas de mínimo.", Icon: Package, usaPeriodo: false },
    { tipo: "caixa", titulo: "Caixa", desc: "Sessões de caixa, valores esperados, contados e diferenças.", Icon: Wallet, usaPeriodo: true },
    { tipo: "clientes", titulo: "Clientes", desc: "Base de clientes com contactos e estado.", Icon: Users, usaPeriodo: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Gere PDFs com o logotipo e os dados da empresa, ou imprima directamente" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>Aplicado aos relatórios de vendas e caixa.</CardDescription>
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
                <div>
                  <CardTitle className="text-base">{titulo}</CardTitle>
                  <CardDescription>{usaPeriodo ? "Usa o período seleccionado" : "Posição actual"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{desc}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => run(tipo, "pdf")}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {busy === `${tipo}-pdf` ? "A gerar..." : "Exportar PDF"}
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
    </div>
  );
}
