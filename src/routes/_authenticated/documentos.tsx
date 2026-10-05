import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, FileText, Printer, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registarAuditoria, exportarCsv } from "@/lib/auditoria";
import { getEmpresaDoc, imprimirPdf, moeda, nomeFicheiro } from "@/lib/pdf";
import { criarDocumentoPdf } from "@/lib/documentos-pdf";
import { useEmpresa } from "@/hooks/use-empresa";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Faturas e Cotações — INDICO GROUP" },
      { name: "description", content: "Emissão de faturas e cotações com numeração automática, pagamentos e impressão A4." },
    ],
  }),
  component: DocumentosPage,
});

type Tipo = "fatura" | "cotacao";
type Metodo = Database["public"]["Enums"]["pagamento_metodo"];
type Linha = { produto_id: string | null; descricao: string; quantidade: number; unidade: string; preco_unitario: number; desconto: number; imposto_percent: number };

const EST_FAT: Record<string, string> = { rascunho: "Rascunho", emitida: "Emitida", parcial: "Parcialmente paga", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada" };
const EST_COT: Record<string, string> = { rascunho: "Rascunho", enviada: "Enviada", aceite: "Aceite", recusada: "Recusada", expirada: "Expirada", convertida: "Convertida", cancelada: "Cancelada" };
const METODOS: Metodo[] = ["dinheiro", "mpesa", "emola", "pos", "transferencia"];

function erro(e: unknown) {
  toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erro");
}

function DocumentosPage() {
  return (
    <div>
      <PageHeader title="Faturas e Cotações" description="Documentos comerciais com numeração automática e controlada pelo sistema." />
      <Tabs defaultValue="fatura">
        <TabsList>
          <TabsTrigger value="fatura">Faturas</TabsTrigger>
          <TabsTrigger value="cotacao">Cotações</TabsTrigger>
        </TabsList>
        <TabsContent value="fatura"><Lista tipo="fatura" /></TabsContent>
        <TabsContent value="cotacao"><Lista tipo="cotacao" /></TabsContent>
      </Tabs>
    </div>
  );
}

function Lista({ tipo }: { tipo: Tipo }) {
  const qc = useQueryClient();
  const { config } = useEmpresa();
  const cur = config?.moeda ?? "MZN";
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState("todos");
  const [editar, setEditar] = useState<string | "novo" | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const estados = tipo === "fatura" ? EST_FAT : EST_COT;

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["docs", tipo],
    queryFn: async () => {
      const q = tipo === "fatura"
        ? supabase.from("faturas").select("id, numero, status, data_emissao, data_vencimento, cliente_nome, total, valor_pago").order("created_at", { ascending: false })
        : supabase.from("cotacoes").select("id, numero, status, data, validade, cliente_nome, total").order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data as { id: string; numero: string; status: string; cliente_nome: string | null; total: number; valor_pago?: number; data_emissao?: string; data?: string; data_vencimento?: string | null; validade?: string | null }[];
    },
  });

  const lista = useMemo(() => data.filter((d) =>
    (estado === "todos" || d.status === estado) &&
    (!busca || `${d.numero} ${d.cliente_nome ?? ""}`.toLowerCase().includes(busca.toLowerCase()))), [data, busca, estado]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["docs"] });

  return (
    <Card className="mt-4">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Pesquisar nº ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              {Object.entries(estados).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => {
            exportarCsv(tipo === "fatura" ? "faturas" : "cotacoes", ["Número", "Data", "Cliente", "Estado", "Total", "Pago"],
              lista.map((d) => [d.numero, d.data_emissao ?? d.data ?? "", d.cliente_nome, estados[d.status], d.total, d.valor_pago ?? null]));
          }}><Download className="mr-1 h-4 w-4" />CSV</Button>
          <Button onClick={() => setEditar("novo")}><Plus className="mr-1 h-4 w-4" />{tipo === "fatura" ? "Nova fatura" : "Nova cotação"}</Button>
        </div>
        {error ? <p className="text-sm text-destructive">Erro ao carregar documentos.</p> : isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted/40" />
        ) : lista.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8" />Sem documentos.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Número</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>{tipo === "fatura" && <TableHead className="text-right">Em dívida</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {lista.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setVer(d.id)}>
                    <TableCell className="font-medium">{d.numero}</TableCell>
                    <TableCell>{d.data_emissao ?? d.data}</TableCell>
                    <TableCell>{d.cliente_nome ?? "—"}</TableCell>
                    <TableCell><Badge variant={d.status === "cancelada" || d.status === "recusada" ? "destructive" : "secondary"}>{estados[d.status]}</Badge></TableCell>
                    <TableCell className="text-right">{moeda(d.total, cur)}</TableCell>
                    {tipo === "fatura" && <TableCell className="text-right">{moeda(d.total - (d.valor_pago ?? 0), cur)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editar && <Editor tipo={tipo} id={editar === "novo" ? null : editar} onClose={(id) => { setEditar(null); refresh(); if (id) setVer(id); }} />}
      {ver && <Detalhe tipo={tipo} id={ver} onClose={() => { setVer(null); refresh(); }} onEditar={(id) => { setVer(null); setEditar(id); }} />}
    </Card>
  );
}

function Editor({ tipo, id, onClose }: { tipo: Tipo; id: string | null; onClose: (id?: string) => void }) {
  const { config } = useEmpresa();
  const ivaPadrao = Number((config as { iva_percent?: number } | null)?.iva_percent ?? 0);
  const [cab, setCab] = useState({ cliente_id: "", cliente_nome: "", cliente_nuit: "", cliente_telefone: "", cliente_email: "", cliente_endereco: "", vencimento: "", observacoes: "", condicoes: "", estabelecimento: "" });
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [aGuardar, setAGuardar] = useState(false);
  const [carregado, setCarregado] = useState(!id);

  const { data: clientes = [] } = useQuery({ queryKey: ["doc-clientes"], queryFn: async () => (await supabase.from("clientes").select("id, nome, nif, telefone, email, morada").eq("is_active", true).order("nome")).data ?? [] });
  const { data: produtos = [] } = useQuery({ queryKey: ["doc-produtos"], queryFn: async () => (await supabase.from("produtos").select("id, nome, preco_venda, unidade, codigo").eq("is_active", true).order("nome")).data ?? [] });

  useQuery({
    queryKey: ["doc-edit", tipo, id],
    enabled: !!id,
    queryFn: async () => {
      const tab = tipo === "fatura" ? "faturas" : "cotacoes";
      const { data: h } = await supabase.from(tab).select("*").eq("id", id!).single();
      const { data: it } = tipo === "fatura"
        ? await supabase.from("fatura_itens").select("*").eq("fatura_id", id!).order("ordem")
        : await supabase.from("cotacao_itens").select("*").eq("cotacao_id", id!).order("ordem");
      const r = h as Record<string, string | null>;
      setCab({ cliente_id: r.cliente_id ?? "", cliente_nome: r.cliente_nome ?? "", cliente_nuit: r.cliente_nuit ?? "", cliente_telefone: r.cliente_telefone ?? "", cliente_email: r.cliente_email ?? "", cliente_endereco: r.cliente_endereco ?? "", vencimento: (tipo === "fatura" ? r.data_vencimento : r.validade) ?? "", observacoes: r.observacoes ?? "", condicoes: r.condicoes ?? "", estabelecimento: r.estabelecimento ?? "" });
      setLinhas((it ?? []).map((i) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade ?? "", preco_unitario: Number(i.preco_unitario), desconto: Number(i.desconto), imposto_percent: Number(i.imposto_percent) })));
      setCarregado(true);
      return true;
    },
  });

  const calc = (l: Linha) => { const base = l.quantidade * l.preco_unitario - l.desconto; return base + base * l.imposto_percent / 100; };
  const total = linhas.reduce((s, l) => s + calc(l), 0);
  const set = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const guardar = async () => {
    if (linhas.length === 0 || linhas.some((l) => !l.descricao.trim() || l.quantidade <= 0 || l.preco_unitario < 0)) return toast.error("Adicione itens válidos (descrição, quantidade > 0, preço ≥ 0).");
    setAGuardar(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: perfil } = await supabase.from("profiles").select("full_name").eq("id", u.user!.id).maybeSingle();
      const comum = {
        cliente_id: cab.cliente_id || null, cliente_nome: cab.cliente_nome || null, cliente_nuit: cab.cliente_nuit || null,
        cliente_telefone: cab.cliente_telefone || null, cliente_email: cab.cliente_email || null, cliente_endereco: cab.cliente_endereco || null,
        observacoes: cab.observacoes || null, estabelecimento: cab.estabelecimento || null,
      };
      let docId = id;
      if (tipo === "fatura") {
        const payload = { ...comum, data_vencimento: cab.vencimento || null };
        if (docId) { const { error } = await supabase.from("faturas").update(payload).eq("id", docId); if (error) throw error; }
        else { const { data, error } = await supabase.from("faturas").insert({ ...payload, numero: "", user_id: u.user!.id, vendedor_id: u.user!.id, vendedor_nome: perfil?.full_name ?? null }).select("id").single(); if (error) throw error; docId = data.id; }
        await supabase.from("fatura_itens").delete().eq("fatura_id", docId!);
        const { error } = await supabase.from("fatura_itens").insert(linhas.map((l, ordem) => ({ ...l, unidade: l.unidade || null, fatura_id: docId!, ordem })));
        if (error) throw error;
      } else {
        const payload = { ...comum, validade: cab.vencimento || null, condicoes: cab.condicoes || null };
        if (docId) { const { error } = await supabase.from("cotacoes").update(payload).eq("id", docId); if (error) throw error; }
        else { const { data, error } = await supabase.from("cotacoes").insert({ ...payload, numero: "", user_id: u.user!.id, vendedor_id: u.user!.id, vendedor_nome: perfil?.full_name ?? null }).select("id").single(); if (error) throw error; docId = data.id; }
        await supabase.from("cotacao_itens").delete().eq("cotacao_id", docId!);
        const { error } = await supabase.from("cotacao_itens").insert(linhas.map((l, ordem) => ({ ...l, unidade: l.unidade || null, cotacao_id: docId!, ordem })));
        if (error) throw error;
      }
      await registarAuditoria({ modulo: "Documentos", acao: id ? "editar" : "criar", entidade: tipo, entidade_id: docId, descricao: `${id ? "Alterou" : "Criou"} ${tipo === "fatura" ? "fatura" : "cotação"}` });
      toast.success("Documento guardado");
      onClose(docId!);
    } catch (e) { erro(e); } finally { setAGuardar(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{id ? "Editar" : "Nova"} {tipo === "fatura" ? "fatura (rascunho)" : "cotação"}</DialogTitle></DialogHeader>
        {!carregado ? <div className="h-40 animate-pulse rounded bg-muted/40" /> : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Cliente registado (opcional)</Label>
                <Select value={cab.cliente_id || "nenhum"} onValueChange={(v) => {
                  const c = clientes.find((x) => x.id === v);
                  setCab((s) => c ? { ...s, cliente_id: c.id, cliente_nome: c.nome, cliente_nuit: c.nif ?? "", cliente_telefone: c.telefone ?? "", cliente_email: c.email ?? "", cliente_endereco: c.morada ?? "" } : { ...s, cliente_id: "" });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Escrever manualmente —</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {([["cliente_nome", "Nome do cliente"], ["cliente_nuit", "NUIT"], ["cliente_telefone", "Telefone"], ["cliente_email", "Email"], ["cliente_endereco", "Endereço"], ["estabelecimento", "Estabelecimento"]] as const).map(([k, l]) => (
                <div key={k}><Label>{l}</Label><Input value={cab[k]} onChange={(e) => setCab((s) => ({ ...s, [k]: e.target.value }))} /></div>
              ))}
              <div><Label>{tipo === "fatura" ? "Data de vencimento" : "Validade"}</Label><Input type="date" value={cab.vencimento} onChange={(e) => setCab((s) => ({ ...s, vencimento: e.target.value }))} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <div className="flex gap-2">
                  <Select value="" onValueChange={(v) => { const p = produtos.find((x) => x.id === v); if (p) setLinhas((ls) => [...ls, { produto_id: p.id, descricao: p.nome, quantidade: 1, unidade: p.unidade, preco_unitario: Number(p.preco_venda), desconto: 0, imposto_percent: ivaPadrao }]); }}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="+ Produto" /></SelectTrigger>
                    <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, { produto_id: null, descricao: "", quantidade: 1, unidade: "", preco_unitario: 0, desconto: 0, imposto_percent: ivaPadrao }])}>+ Serviço</Button>
                </div>
              </div>
              {linhas.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-[2fr_repeat(5,1fr)_auto]">
                  <Input className="col-span-2 sm:col-span-1" placeholder="Descrição" value={l.descricao} onChange={(e) => set(i, { descricao: e.target.value })} />
                  <Input type="number" title="Quantidade" value={l.quantidade} onChange={(e) => set(i, { quantidade: Number(e.target.value) })} />
                  <Input placeholder="Un." value={l.unidade} onChange={(e) => set(i, { unidade: e.target.value })} />
                  <Input type="number" title="Preço unitário" value={l.preco_unitario} onChange={(e) => set(i, { preco_unitario: Number(e.target.value) })} />
                  <Input type="number" title="Desconto (valor)" value={l.desconto} onChange={(e) => set(i, { desconto: Number(e.target.value) })} />
                  <Input type="number" title="Imposto %" value={l.imposto_percent} onChange={(e) => set(i, { imposto_percent: Number(e.target.value) })} />
                  <Button variant="ghost" size="icon" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Colunas: descrição, quantidade, unidade, preço, desconto (valor), imposto %. Os totais finais são calculados pelo sistema.</p>
              <p className="text-right font-semibold">Total estimado: {moeda(total, config?.moeda ?? "MZN")}</p>
            </div>
            {tipo === "cotacao" && <div><Label>Condições</Label><Textarea value={cab.condicoes} onChange={(e) => setCab((s) => ({ ...s, condicoes: e.target.value }))} /></div>}
            <div><Label>Observações</Label><Textarea value={cab.observacoes} onChange={(e) => setCab((s) => ({ ...s, observacoes: e.target.value }))} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={guardar} disabled={aGuardar || !carregado}>{aGuardar ? "A guardar…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detalhe({ tipo, id, onClose, onEditar }: { tipo: Tipo; id: string; onClose: () => void; onEditar: (id: string) => void }) {
  const qc = useQueryClient();
  const { config } = useEmpresa();
  const { isAdmin, roles } = usePermissions();
  const cur = config?.moeda ?? "MZN";
  const [acao, setAcao] = useState<null | "pagar" | "cancelar">(null);
  const [valor, setValor] = useState(0);
  const [metodo, setMetodo] = useState<Metodo>("dinheiro");
  const [ref, setRef] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const podeCancelar = isAdmin || roles.includes("gerente");
  const podeConverter = podeCancelar || roles.includes("supervisor");

  const { data, refetch } = useQuery({
    queryKey: ["doc-det", tipo, id],
    queryFn: async () => {
      if (tipo === "fatura") {
        const [{ data: h }, { data: it }, { data: pg }] = await Promise.all([
          supabase.from("faturas").select("*").eq("id", id).single(),
          supabase.from("fatura_itens").select("*").eq("fatura_id", id).order("ordem"),
          supabase.from("fatura_pagamentos").select("*").eq("fatura_id", id).order("created_at"),
        ]);
        return { h: h as Record<string, unknown>, it: it ?? [], pg: pg ?? [] };
      }
      const [{ data: h }, { data: it }] = await Promise.all([
        supabase.from("cotacoes").select("*").eq("id", id).single(),
        supabase.from("cotacao_itens").select("*").eq("cotacao_id", id).order("ordem"),
      ]);
      return { h: h as Record<string, unknown>, it: it ?? [], pg: [] as { id: string; valor: number; metodo: string; data: string; referencia: string | null }[] };
    },
  });

  const run = async (fn: () => PromiseLike<{ error: unknown }>, audit: string, desc: string) => {
    setOcupado(true);
    const { error } = await fn();
    setOcupado(false);
    if (error) return erro(error);
    await registarAuditoria({ modulo: "Documentos", acao: audit, entidade: tipo, entidade_id: id, descricao: desc });
    toast.success("Feito");
    setAcao(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["docs"] });
  };

  const pdf = async (imprimir: boolean) => {
    if (!data) return;
    const h = data.h as Record<string, never>;
    const estados = tipo === "fatura" ? EST_FAT : EST_COT;
    const doc = criarDocumentoPdf(await getEmpresaDoc(), {
      tipo: tipo === "fatura" ? "FATURA" : "COTAÇÃO", numero: h.numero, data: tipo === "fatura" ? h.data_emissao : h.data,
      vencimento: tipo === "fatura" ? h.data_vencimento : h.validade, estado: estados[h.status as string],
      cliente_nome: h.cliente_nome, cliente_nuit: h.cliente_nuit, cliente_telefone: h.cliente_telefone, cliente_email: h.cliente_email, cliente_endereco: h.cliente_endereco,
      vendedor_nome: h.vendedor_nome, observacoes: h.observacoes, condicoes: h.condicoes,
      subtotal: Number(h.subtotal), total_desconto: Number(h.total_desconto), total_imposto: Number(h.total_imposto), total: Number(h.total),
      valor_pago: tipo === "fatura" ? Number(h.valor_pago) : undefined,
      itens: data.it.map((i) => ({ descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade, preco_unitario: Number(i.preco_unitario), desconto: Number(i.desconto), imposto_percent: Number(i.imposto_percent), total: Number(i.total) })),
    });
    await registarAuditoria({ modulo: "Documentos", acao: imprimir ? "imprimir" : "exportar_pdf", entidade: tipo, entidade_id: id, descricao: `${imprimir ? "Imprimiu" : "Exportou"} ${h.numero}` });
    if (imprimir) imprimirPdf(doc); else doc.save(nomeFicheiro(String(h.numero)));
  };

  if (!data) return null;
  const h = data.h as Record<string, never>;
  const st = h.status as string;
  const divida = Number(h.total) - Number(h.valor_pago ?? 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{h.numero} — {(tipo === "fatura" ? EST_FAT : EST_COT)[st]}</DialogTitle></DialogHeader>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><b>Cliente:</b> {h.cliente_nome ?? "—"}</p>
          <p><b>NUIT:</b> {h.cliente_nuit ?? "—"}</p>
          <p><b>Data:</b> {tipo === "fatura" ? h.data_emissao : h.data}</p>
          <p><b>{tipo === "fatura" ? "Vencimento" : "Validade"}:</b> {(tipo === "fatura" ? h.data_vencimento : h.validade) ?? "—"}</p>
          {h.motivo_cancelamento && <p className="sm:col-span-2 text-destructive"><b>Motivo do cancelamento:</b> {h.motivo_cancelamento}</p>}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Qtd</TableHead><TableHead>Preço</TableHead><TableHead>Imp.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{data.it.map((i) => (
              <TableRow key={i.id}><TableCell>{i.descricao}</TableCell><TableCell>{i.quantidade} {i.unidade}</TableCell><TableCell>{moeda(i.preco_unitario, cur)}</TableCell><TableCell>{i.imposto_percent}%</TableCell><TableCell className="text-right">{moeda(i.total, cur)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </div>
        <div className="space-y-1 text-right text-sm">
          <p>Subtotal: {moeda(h.subtotal, cur)} · Descontos: {moeda(h.total_desconto, cur)} · Imposto: {moeda(h.total_imposto, cur)}</p>
          <p className="text-lg font-bold">Total: {moeda(h.total, cur)}</p>
          {tipo === "fatura" && <p>Pago: {moeda(h.valor_pago, cur)} · <b>Em dívida: {moeda(divida, cur)}</b></p>}
        </div>
        {data.pg.length > 0 && (
          <div className="text-sm"><b>Pagamentos:</b>
            {data.pg.map((p) => <p key={p.id}>{p.data} — {moeda(p.valor, cur)} ({p.metodo}{p.referencia ? `, ${p.referencia}` : ""})</p>)}
          </div>
        )}

        {acao === "pagar" && (
          <div className="grid gap-2 rounded border p-3 sm:grid-cols-4">
            <Input type="number" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
            <Select value={metodo} onValueChange={(v) => setMetodo(v as Metodo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Referência" value={ref} onChange={(e) => setRef(e.target.value)} />
            <Button disabled={ocupado || valor <= 0} onClick={async () => {
              const { data: u } = await supabase.auth.getUser();
              run(() => supabase.from("fatura_pagamentos").insert({ fatura_id: id, valor, metodo, referencia: ref || null, user_id: u.user?.id ?? null }), "pagamento", `Pagamento de ${moeda(valor, cur)} em ${h.numero}`);
            }}>Confirmar</Button>
          </div>
        )}
        {acao === "cancelar" && (
          <div className="space-y-2 rounded border p-3">
            <Label>Motivo do cancelamento</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button variant="destructive" disabled={ocupado || motivo.trim().length < 3} onClick={() =>
              tipo === "fatura"
                ? run(() => supabase.rpc("cancelar_fatura", { p_id: id, p_motivo: motivo }), "cancelar", `Cancelou ${h.numero}: ${motivo}`)
                : run(() => supabase.from("cotacoes").update({ status: "cancelada", observacoes: [h.observacoes, `Cancelada: ${motivo}`].filter(Boolean).join("\n") }).eq("id", id), "cancelar", `Cancelou ${h.numero}: ${motivo}`)
            }>Confirmar cancelamento</Button>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => pdf(false)}><Download className="mr-1 h-4 w-4" />PDF</Button>
          <Button variant="outline" onClick={() => pdf(true)}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          {st === "rascunho" && <Button variant="outline" onClick={() => onEditar(id)}>Editar</Button>}
          {tipo === "fatura" && st === "rascunho" && <Button disabled={ocupado} onClick={() => run(() => supabase.rpc("emitir_fatura", { p_id: id }), "emitir", `Emitiu ${h.numero}`)}>Emitir</Button>}
          {tipo === "fatura" && ["emitida", "parcial", "vencida"].includes(st) && <Button onClick={() => { setValor(divida); setAcao("pagar"); }}>Registar pagamento</Button>}
          {tipo === "cotacao" && st === "rascunho" && <Button disabled={ocupado} onClick={() => run(() => supabase.from("cotacoes").update({ status: "enviada" }).eq("id", id), "enviar", `Marcou ${h.numero} como enviada`)}>Marcar enviada</Button>}
          {tipo === "cotacao" && ["rascunho", "enviada"].includes(st) && <>
            <Button disabled={ocupado} onClick={() => run(() => supabase.from("cotacoes").update({ status: "aceite" }).eq("id", id), "aceitar", `Aceitou ${h.numero}`)}>Aceite</Button>
            <Button variant="outline" disabled={ocupado} onClick={() => run(() => supabase.from("cotacoes").update({ status: "recusada" }).eq("id", id), "recusar", `Recusou ${h.numero}`)}>Recusada</Button>
          </>}
          {tipo === "cotacao" && st === "aceite" && podeConverter && <>
            <Button disabled={ocupado} onClick={() => run(() => supabase.rpc("converter_cotacao", { p_id: id, p_destino: "fatura" }), "converter", `Converteu ${h.numero} em fatura`)}>Converter em fatura</Button>
            <Button variant="outline" disabled={ocupado} onClick={() => run(() => supabase.rpc("converter_cotacao", { p_id: id, p_destino: "venda" }), "converter", `Converteu ${h.numero} em venda`)}>Converter em venda</Button>
          </>}
          {podeCancelar && !["cancelada", "paga", "convertida", "recusada"].includes(st) && <Button variant="destructive" onClick={() => setAcao("cancelar")}>Cancelar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
