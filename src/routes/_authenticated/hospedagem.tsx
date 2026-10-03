import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BedDouble, Plus, Pencil, LogIn, LogOut, CalendarPlus, XCircle, Receipt, Printer, ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresa } from "@/hooks/use-empresa";
import { registarAuditoria, exportarCsv } from "@/lib/auditoria";

export const Route = createFileRoute("/_authenticated/hospedagem")({
  head: () => ({
    meta: [
      { title: "Pensão e Hospedagem — Aldeia Mesa" },
      { name: "description", content: "Quartos, hóspedes, reservas, check-in, check-out, consumos e relatório de ocupação." },
      { property: "og:title", content: "Pensão e Hospedagem — Aldeia Mesa" },
      { property: "og:description", content: "Gestão completa de quartos, reservas e estadias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HospedagemPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ESTADOS_QUARTO: Record<string, { label: string; cls: string }> = {
  livre: { label: "Livre", cls: "bg-success/15 text-success border-success/30" },
  reservado: { label: "Reservado", cls: "bg-primary/15 text-primary border-primary/30" },
  ocupado: { label: "Ocupado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  limpeza: { label: "Limpeza", cls: "bg-warning/15 text-warning border-warning/30" },
  manutencao: { label: "Manutenção", cls: "bg-muted text-muted-foreground" },
};
const ESTADOS_RES: Record<string, string> = { reservada: "Reservada", checkin: "Hospedado", checkout: "Concluída", cancelada: "Cancelada" };
const METODOS = ["dinheiro", "mpesa", "emola", "pos", "transferencia"];
const sel = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const hoje = () => new Date().toISOString().slice(0, 10);
const addDias = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const noitesEntre = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
const errMsg = (e: unknown) => (e as { message?: string })?.message ?? "Erro";

function useDados() {
  return useQuery({
    queryKey: ["hospedagem"],
    queryFn: async () => {
      const [t, q, h, r, c, p] = await Promise.all([
        db.from("quarto_tipos").select("*").order("nome"),
        db.from("quartos").select("*").order("numero"),
        db.from("hospedes").select("*").order("nome"),
        db.from("reservas").select("*").order("checkin", { ascending: false }),
        db.from("reserva_consumos").select("*").order("created_at"),
        db.from("reserva_pagamentos").select("*").order("created_at"),
      ]);
      for (const x of [t, q, h, r, c, p]) if (x.error) throw x.error;
      return { tipos: t.data as Row[], quartos: q.data as Row[], hospedes: h.data as Row[], reservas: r.data as Row[], consumos: c.data as Row[], pagamentos: p.data as Row[] };
    },
  });
}

function HospedagemPage() {
  const { data, isLoading, error } = useDados();
  const { config } = useEmpresa();
  const moeda = config?.moeda ?? "MT";
  const fmt = (v: number) => `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moeda}`;
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["hospedagem"] });

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted/40" />;
  if (error || !data) return <p className="text-destructive">Erro ao carregar: {errMsg(error)}</p>;

  const ctx = { ...data, fmt, refresh };
  return (
    <div>
      <PageHeader title="Pensão / Hospedagem" description="Quartos, hóspedes, reservas e estadias" />
      <Tabs defaultValue="calendario">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="quartos">Quartos</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de quarto</TabsTrigger>
          <TabsTrigger value="hospedes">Hóspedes</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>
        <TabsContent value="calendario"><Calendario {...ctx} /></TabsContent>
        <TabsContent value="reservas"><Reservas {...ctx} /></TabsContent>
        <TabsContent value="quartos"><Quartos {...ctx} /></TabsContent>
        <TabsContent value="tipos"><Tipos {...ctx} /></TabsContent>
        <TabsContent value="hospedes"><Hospedes {...ctx} /></TabsContent>
        <TabsContent value="relatorio"><Relatorio {...ctx} /></TabsContent>
      </Tabs>
    </div>
  );
}

type Ctx = ReturnType<typeof useDados>["data"] & { fmt: (v: number) => string; refresh: () => void };

/* ---------------- Calendário ---------------- */
function Calendario(c: NonNullable<Ctx>) {
  const [inicio, setInicio] = useState(hoje());
  const dias = Array.from({ length: 14 }, (_, i) => addDias(inicio, i));
  const ativos = c.reservas.filter((r) => r.estado === "reservada" || r.estado === "checkin");
  const hosp = (id: string) => c.hospedes.find((h) => h.id === id)?.nome ?? "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ocupação — 14 dias</CardTitle>
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => setInicio(addDias(inicio, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
          <Button size="icon" variant="outline" onClick={() => setInicio(addDias(inicio, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {c.quartos.length === 0 ? <p className="text-sm text-muted-foreground">Sem quartos registados.</p> : (
          <table className="w-full min-w-[800px] border-collapse text-xs">
            <thead><tr><th className="p-1 text-left">Quarto</th>{dias.map((d) => <th key={d} className="p-1 font-normal text-muted-foreground">{d.slice(8)}/{d.slice(5, 7)}</th>)}</tr></thead>
            <tbody>
              {c.quartos.map((q) => (
                <tr key={q.id} className="border-t">
                  <td className="p-1 font-medium">{q.numero}</td>
                  {dias.map((d) => {
                    const r = ativos.find((x) => x.quarto_id === q.id && x.checkin <= d && d < x.checkout);
                    return (
                      <td key={d} className="p-0.5">
                        <div title={r ? `${hosp(r.hospede_id)} (${ESTADOS_RES[r.estado]})` : "Livre"}
                          className={`h-7 truncate rounded px-1 leading-7 ${r ? (r.estado === "checkin" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary") : "bg-muted/40"}`}>
                          {r && r.checkin === d ? hosp(r.hospede_id).split(" ")[0] : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary/20" />Reservado</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/20" />Ocupado</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted/40" />Livre</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Reservas ---------------- */
function Reservas(c: NonNullable<Ctx>) {
  const [nova, setNova] = useState(false);
  const [conta, setConta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("ativas");
  const hosp = (id: string) => c.hospedes.find((h) => h.id === id)?.nome ?? "—";
  const qto = (id: string) => c.quartos.find((h) => h.id === id)?.numero ?? "—";
  const lista = c.reservas.filter((r) => filtro === "todas" || (filtro === "ativas" ? ["reservada", "checkin"].includes(r.estado) : r.estado === filtro));

  const acao = async (id: string, a: string, extra: { p_data?: string; p_motivo?: string } = {}) => {
    const { error } = await db.rpc("reserva_acao", { p_id: id, p_acao: a, p_data: extra.p_data ?? null, p_motivo: extra.p_motivo ?? null });
    if (error) return toast.error(error.message);
    toast.success("Operação concluída"); c.refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <select className={sel + " w-48"} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="ativas">Activas</option><option value="todas">Todas</option>
          {Object.entries(ESTADOS_RES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button onClick={() => setNova(true)}><Plus className="mr-1 h-4 w-4" />Nova reserva</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Hóspede</TableHead><TableHead>Quarto</TableHead><TableHead>Entrada</TableHead><TableHead>Saída</TableHead>
            <TableHead>Noites</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {lista.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sem reservas.</TableCell></TableRow>}
            {lista.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{hosp(r.hospede_id)}</TableCell>
                <TableCell>{qto(r.quarto_id)}</TableCell>
                <TableCell>{r.checkin}</TableCell><TableCell>{r.checkout}</TableCell><TableCell>{r.noites}</TableCell>
                <TableCell className="text-right">{c.fmt(r.total)}</TableCell>
                <TableCell className="text-right">{c.fmt(r.total - r.valor_pago)}</TableCell>
                <TableCell><Badge variant="outline">{ESTADOS_RES[r.estado]}</Badge></TableCell>
                <TableCell className="space-x-1 whitespace-nowrap text-right">
                  {r.estado === "reservada" && <Button size="sm" variant="outline" onClick={() => acao(r.id, "checkin")}><LogIn className="mr-1 h-3 w-3" />Check-in</Button>}
                  {["reservada", "checkin"].includes(r.estado) && <Button size="sm" variant="ghost" title="Estender" onClick={() => {
                    const d = prompt("Nova data de saída (AAAA-MM-DD)", addDias(r.checkout, 1)); if (d) acao(r.id, "estender", { p_data: d });
                  }}><CalendarPlus className="h-4 w-4" /></Button>}
                  <Button size="sm" variant="ghost" title="Conta / consumos" onClick={() => setConta(r.id)}><Receipt className="h-4 w-4" /></Button>
                  {r.estado === "reservada" && <Button size="sm" variant="ghost" title="Cancelar" onClick={() => {
                    const m = prompt("Motivo do cancelamento"); if (m) acao(r.id, "cancelar", { p_motivo: m });
                  }}><XCircle className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {nova && <NovaReserva c={c} onClose={() => setNova(false)} />}
      {conta && <Conta c={c} id={conta} onClose={() => setConta(null)} onAcao={acao} />}
    </Card>
  );
}

function NovaReserva({ c, onClose }: { c: NonNullable<Ctx>; onClose: () => void }) {
  const [f, setF] = useState({ hospede_id: "", quarto_id: "", checkin: hoje(), checkout: addDias(hoje(), 1), num_hospedes: 1, preco_noite: 0, desconto: 0, observacoes: "" });
  const [saving, setSaving] = useState(false);
  const precoQuarto = (id: string) => { const q = c.quartos.find((x) => x.id === id); return Number(q?.preco ?? c.tipos.find((t) => t.id === q?.tipo_id)?.preco ?? 0); };
  const noites = noitesEntre(f.checkin, f.checkout);
  const total = Math.max(0, noites * f.preco_noite - f.desconto);
  const salvar = async () => {
    if (!f.hospede_id || !f.quarto_id) return toast.error("Escolha hóspede e quarto");
    if (noites < 1) return toast.error("A saída deve ser depois da entrada");
    setSaving(true);
    const { data, error } = await db.from("reservas").insert({ ...f, observacoes: f.observacoes || null }).select("id").single();
    if (!error) await db.from("quartos").update({ estado: "reservado" }).eq("id", f.quarto_id).eq("estado", "livre");
    setSaving(false);
    if (error) return toast.error(error.message);
    registarAuditoria({ modulo: "Hospedagem", acao: "criar", entidade: "reservas", entidade_id: data.id, descricao: "Nova reserva" });
    toast.success("Reserva criada"); c.refresh(); onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Hóspede</Label>
            <select className={sel} value={f.hospede_id} onChange={(e) => setF({ ...f, hospede_id: e.target.value })}>
              <option value="">— escolher —</option>{c.hospedes.map((h) => <option key={h.id} value={h.id}>{h.nome}{h.documento ? ` (${h.documento})` : ""}</option>)}
            </select>
            {c.hospedes.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Registe primeiro um hóspede no separador Hóspedes.</p>}
          </div>
          <div className="col-span-2"><Label>Quarto</Label>
            <select className={sel} value={f.quarto_id} onChange={(e) => setF({ ...f, quarto_id: e.target.value, preco_noite: precoQuarto(e.target.value) })}>
              <option value="">— escolher —</option>
              {c.quartos.filter((q) => q.is_active && q.estado !== "manutencao").map((q) => <option key={q.id} value={q.id}>{q.numero} — {c.tipos.find((t) => t.id === q.tipo_id)?.nome ?? ""} ({ESTADOS_QUARTO[q.estado].label})</option>)}
            </select>
          </div>
          <div><Label>Check-in</Label><Input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></div>
          <div><Label>Check-out</Label><Input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></div>
          <div><Label>Nº de hóspedes</Label><Input type="number" min={1} value={f.num_hospedes} onChange={(e) => setF({ ...f, num_hospedes: Number(e.target.value) })} /></div>
          <div><Label>Preço por noite</Label><Input type="number" min={0} value={f.preco_noite} onChange={(e) => setF({ ...f, preco_noite: Number(e.target.value) })} /></div>
          <div><Label>Desconto</Label><Input type="number" min={0} value={f.desconto} onChange={(e) => setF({ ...f, desconto: Number(e.target.value) })} /></div>
          <div className="flex flex-col justify-end text-sm"><span className="text-muted-foreground">{noites} noite(s) × {c.fmt(f.preco_noite)}</span><span className="font-semibold">{c.fmt(total)}</span></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={saving} onClick={salvar}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Conta({ c, id, onClose, onAcao }: { c: NonNullable<Ctx>; id: string; onClose: () => void; onAcao: (id: string, a: string) => Promise<unknown> }) {
  const r = c.reservas.find((x) => x.id === id)!;
  const consumos = c.consumos.filter((x) => x.reserva_id === id);
  const pags = c.pagamentos.filter((x) => x.reserva_id === id);
  const h = c.hospedes.find((x) => x.id === r.hospede_id);
  const q = c.quartos.find((x) => x.id === r.quarto_id);
  const aberta = ["reservada", "checkin"].includes(r.estado);
  const saldo = Math.round((r.total - r.valor_pago) * 100) / 100;
  const [cons, setCons] = useState({ origem: "restaurante", descricao: "", quantidade: 1, preco_unitario: 0 });
  const [pag, setPag] = useState({ valor: 0, metodo: "dinheiro", referencia: "" });

  const addConsumo = async () => {
    if (!cons.descricao) return toast.error("Indique a descrição");
    const { error } = await db.from("reserva_consumos").insert({ ...cons, reserva_id: id });
    if (error) return toast.error(error.message);
    setCons({ ...cons, descricao: "", quantidade: 1, preco_unitario: 0 }); c.refresh();
  };
  const delConsumo = async (cid: string) => { const { error } = await db.from("reserva_consumos").delete().eq("id", cid); if (error) toast.error(error.message); c.refresh(); };
  const pagar = async () => {
    const valor = pag.valor || saldo;
    const { error } = await db.from("reserva_pagamentos").insert({ reserva_id: id, valor, metodo: pag.metodo, referencia: pag.referencia || null });
    if (error) return toast.error(error.message);
    registarAuditoria({ modulo: "Hospedagem", acao: "pagamento", entidade: "reservas", entidade_id: id, descricao: `Pagamento ${c.fmt(valor)}` });
    toast.success("Pagamento registado"); setPag({ ...pag, valor: 0, referencia: "" }); c.refresh();
  };
  const imprimir = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const linhas = consumos.map((x) => `<tr><td>${x.origem}</td><td>${x.descricao}</td><td>${x.quantidade}</td><td style="text-align:right">${c.fmt(x.total)}</td></tr>`).join("");
    w.document.write(`<html><head><title>Conta</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>
      <h2>Conta de hospedagem</h2><p>Hóspede: <b>${h?.nome ?? ""}</b> ${h?.documento ?? ""}<br/>Quarto: ${q?.numero ?? ""} · ${r.checkin} → ${r.checkout} (${r.noites} noites)</p>
      <table><tr><th colspan=3>Estadia: ${r.noites} × ${c.fmt(r.preco_noite)}</th><th style="text-align:right">${c.fmt(r.valor_estadia)}</th></tr>
      <tr><td colspan=3>Desconto</td><td style="text-align:right">-${c.fmt(r.desconto)}</td></tr>${linhas}
      <tr><th colspan=3>Total</th><th style="text-align:right">${c.fmt(r.total)}</th></tr>
      <tr><td colspan=3>Pago</td><td style="text-align:right">${c.fmt(r.valor_pago)}</td></tr>
      <tr><th colspan=3>Saldo</th><th style="text-align:right">${c.fmt(saldo)}</th></tr></table></body></html>`);
    w.document.close(); w.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Conta — {h?.nome} · Quarto {q?.numero}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm sm:grid-cols-4">
          <div><p className="text-muted-foreground">Estadia</p><p className="font-medium">{r.noites} × {c.fmt(r.preco_noite)}</p></div>
          <div><p className="text-muted-foreground">Consumos</p><p className="font-medium">{c.fmt(r.total_consumos)}</p></div>
          <div><p className="text-muted-foreground">Total</p><p className="font-semibold">{c.fmt(r.total)}</p></div>
          <div><p className="text-muted-foreground">Saldo</p><p className={`font-semibold ${saldo > 0 ? "text-destructive" : "text-success"}`}>{c.fmt(saldo)}</p></div>
        </div>
        <h3 className="mt-2 font-semibold">Consumos</h3>
        <Table><TableBody>
          {consumos.length === 0 && <TableRow><TableCell className="text-muted-foreground">Sem consumos.</TableCell></TableRow>}
          {consumos.map((x) => <TableRow key={x.id}><TableCell className="capitalize">{x.origem}</TableCell><TableCell>{x.descricao}</TableCell><TableCell>{x.quantidade} × {c.fmt(x.preco_unitario)}</TableCell><TableCell className="text-right">{c.fmt(x.total)}</TableCell>
            <TableCell>{aberta && <Button size="sm" variant="ghost" onClick={() => delConsumo(x.id)}>✕</Button>}</TableCell></TableRow>)}
        </TableBody></Table>
        {aberta && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select className={sel} value={cons.origem} onChange={(e) => setCons({ ...cons, origem: e.target.value })}><option value="restaurante">Restaurante</option><option value="bar">Bar</option><option value="outros">Outros serviços</option></select>
            <Input className="sm:col-span-2" placeholder="Descrição" value={cons.descricao} onChange={(e) => setCons({ ...cons, descricao: e.target.value })} />
            <Input type="number" placeholder="Qtd" value={cons.quantidade} onChange={(e) => setCons({ ...cons, quantidade: Number(e.target.value) })} />
            <Input type="number" placeholder="Preço" value={cons.preco_unitario} onChange={(e) => setCons({ ...cons, preco_unitario: Number(e.target.value) })} />
            <Button className="col-span-2 sm:col-span-5" variant="outline" onClick={addConsumo}><Plus className="mr-1 h-4 w-4" />Adicionar consumo</Button>
          </div>
        )}
        <h3 className="mt-2 font-semibold">Pagamentos</h3>
        {pags.map((p) => <p key={p.id} className="text-sm">{new Date(p.created_at).toLocaleString("pt-PT")} — {p.metodo} — {c.fmt(p.valor)}</p>)}
        {r.estado !== "cancelada" && saldo > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="number" placeholder={`Valor (${saldo})`} value={pag.valor || ""} onChange={(e) => setPag({ ...pag, valor: Number(e.target.value) })} />
            <select className={sel} value={pag.metodo} onChange={(e) => setPag({ ...pag, metodo: e.target.value })}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
            <Input placeholder="Referência" value={pag.referencia} onChange={(e) => setPag({ ...pag, referencia: e.target.value })} />
            <Button onClick={pagar}>Registar pagamento</Button>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={imprimir}><Printer className="mr-1 h-4 w-4" />Imprimir conta</Button>
          {r.estado === "checkin" && <Button disabled={saldo > 0} onClick={async () => { await onAcao(id, "checkout"); onClose(); }}><LogOut className="mr-1 h-4 w-4" />Check-out</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Quartos ---------------- */
function Quartos(c: NonNullable<Ctx>) {
  const [ed, setEd] = useState<Row | null>(null);
  const salvar = async () => {
    if (!ed?.numero) return toast.error("Indique o número");
    const p = { numero: ed.numero, tipo_id: ed.tipo_id || null, estado: ed.estado ?? "livre", preco: ed.preco === "" || ed.preco == null ? null : Number(ed.preco), observacoes: ed.observacoes || null };
    const { error } = ed.id ? await db.from("quartos").update(p).eq("id", ed.id) : await db.from("quartos").insert(p);
    if (error) return toast.error(error.message);
    toast.success("Quarto guardado"); setEd(null); c.refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEd({ estado: "livre" })}><Plus className="mr-1 h-4 w-4" />Novo quarto</Button></div>
      {c.quartos.length === 0 && <p className="text-sm text-muted-foreground">Sem quartos registados.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {c.quartos.map((q) => {
          const t = c.tipos.find((x) => x.id === q.tipo_id);
          return (
            <Card key={q.id} className="cursor-pointer" onClick={() => setEd(q)}>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center justify-between"><BedDouble className="h-5 w-5 text-primary" /><Badge variant="outline" className={ESTADOS_QUARTO[q.estado].cls}>{ESTADOS_QUARTO[q.estado].label}</Badge></div>
                <p className="text-lg font-bold">{q.numero}</p>
                <p className="text-xs text-muted-foreground">{t?.nome ?? "Sem tipo"} · {c.fmt(q.preco ?? t?.preco ?? 0)}/noite</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {ed && (
        <Dialog open onOpenChange={() => setEd(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{ed.id ? "Editar quarto" : "Novo quarto"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número</Label><Input value={ed.numero ?? ""} onChange={(e) => setEd({ ...ed, numero: e.target.value })} /></div>
              <div><Label>Tipo</Label><select className={sel} value={ed.tipo_id ?? ""} onChange={(e) => setEd({ ...ed, tipo_id: e.target.value })}><option value="">—</option>{c.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
              <div><Label>Estado</Label><select className={sel} value={ed.estado} onChange={(e) => setEd({ ...ed, estado: e.target.value })}>{Object.entries(ESTADOS_QUARTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><Label>Preço (vazio = do tipo)</Label><Input type="number" value={ed.preco ?? ""} onChange={(e) => setEd({ ...ed, preco: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={ed.observacoes ?? ""} onChange={(e) => setEd({ ...ed, observacoes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Tipos ---------------- */
function Tipos(c: NonNullable<Ctx>) {
  const [ed, setEd] = useState<Row | null>(null);
  const salvar = async () => {
    if (!ed?.nome) return toast.error("Indique o nome");
    const p = { nome: ed.nome, capacidade: Number(ed.capacidade || 1), preco: Number(ed.preco || 0), descricao: ed.descricao || null, comodidades: ed.comodidades || null, imagem_url: ed.imagem_url || null };
    const { error } = ed.id ? await db.from("quarto_tipos").update(p).eq("id", ed.id) : await db.from("quarto_tipos").insert(p);
    if (error) return toast.error(error.message);
    toast.success("Tipo guardado"); setEd(null); c.refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEd({ capacidade: 2, preco: 0 })}><Plus className="mr-1 h-4 w-4" />Novo tipo</Button></div>
      {c.tipos.length === 0 && <p className="text-sm text-muted-foreground">Sem tipos de quarto.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {c.tipos.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            {t.imagem_url && <img src={t.imagem_url} alt={t.nome} className="h-36 w-full object-cover" />}
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between"><p className="font-semibold">{t.nome}</p><Button size="icon" variant="ghost" onClick={() => setEd(t)}><Pencil className="h-4 w-4" /></Button></div>
              <p className="text-sm">{c.fmt(t.preco)}/noite · até {t.capacidade} pessoa(s)</p>
              {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
              {t.comodidades && <p className="text-xs">{t.comodidades}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {ed && (
        <Dialog open onOpenChange={() => setEd(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{ed.id ? "Editar tipo" : "Novo tipo de quarto"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome</Label><Input value={ed.nome ?? ""} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></div>
              <div><Label>Capacidade</Label><Input type="number" value={ed.capacidade} onChange={(e) => setEd({ ...ed, capacidade: e.target.value })} /></div>
              <div><Label>Preço por noite</Label><Input type="number" value={ed.preco} onChange={(e) => setEd({ ...ed, preco: e.target.value })} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea value={ed.descricao ?? ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></div>
              <div className="col-span-2"><Label>Comodidades (ex.: Wi-Fi, AC, TV)</Label><Input value={ed.comodidades ?? ""} onChange={(e) => setEd({ ...ed, comodidades: e.target.value })} /></div>
              <div className="col-span-2"><Label>Imagem (link)</Label><Input value={ed.imagem_url ?? ""} onChange={(e) => setEd({ ...ed, imagem_url: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Hóspedes ---------------- */
function Hospedes(c: NonNullable<Ctx>) {
  const [ed, setEd] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const lista = c.hospedes.filter((h) => `${h.nome} ${h.documento ?? ""} ${h.telefone ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const salvar = async () => {
    if (!ed?.nome) return toast.error("Indique o nome");
    const p = { nome: ed.nome, documento: ed.documento || null, telefone: ed.telefone || null, email: ed.email || null, endereco: ed.endereco || null, observacoes: ed.observacoes || null };
    const { error } = ed.id ? await db.from("hospedes").update(p).eq("id", ed.id) : await db.from("hospedes").insert(p);
    if (error) return toast.error(error.message);
    toast.success("Hóspede guardado"); setEd(null); c.refresh();
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <Input className="max-w-xs" placeholder="Pesquisar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setEd({})}><Plus className="mr-1 h-4 w-4" />Novo hóspede</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Documento</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead>Estadias</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {lista.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem hóspedes.</TableCell></TableRow>}
            {lista.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.nome}</TableCell><TableCell>{h.documento}</TableCell><TableCell>{h.telefone}</TableCell><TableCell>{h.email}</TableCell>
                <TableCell>{c.reservas.filter((r) => r.hospede_id === h.id && r.estado !== "cancelada").length}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => setEd(h)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {ed && (
        <Dialog open onOpenChange={() => setEd(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{ed.id ? "Editar hóspede" : "Novo hóspede"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {(["nome", "documento", "telefone", "email"] as const).map((k) => (
                <div key={k} className={k === "nome" ? "col-span-2" : ""}><Label className="capitalize">{k}</Label><Input value={ed[k] ?? ""} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} /></div>
              ))}
              <div className="col-span-2"><Label>Endereço</Label><Input value={ed.endereco ?? ""} onChange={(e) => setEd({ ...ed, endereco: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={ed.observacoes ?? ""} onChange={(e) => setEd({ ...ed, observacoes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/* ---------------- Relatório ---------------- */
function Relatorio(c: NonNullable<Ctx>) {
  const d0 = new Date(); const [ini, setIni] = useState(new Date(d0.getFullYear(), d0.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje());
  const r = useMemo(() => {
    const dias = noitesEntre(ini, fim) + 1;
    const fimEx = addDias(fim, 1);
    const validas = c.reservas.filter((x) => x.estado !== "cancelada");
    let noitesOcup = 0;
    const porQuarto: Record<string, number> = {};
    for (const x of validas) {
      const a = x.checkin > ini ? x.checkin : ini; const b = x.checkout < fimEx ? x.checkout : fimEx;
      const n = noitesEntre(a, b); if (n > 0) { noitesOcup += n; porQuarto[x.quarto_id] = (porQuarto[x.quarto_id] ?? 0) + n; }
    }
    const capacidade = c.quartos.filter((q) => q.is_active).length * dias;
    const pags = c.pagamentos.filter((p) => p.created_at.slice(0, 10) >= ini && p.created_at.slice(0, 10) <= fim);
    const recebido = pags.reduce((s, p) => s + Number(p.valor), 0);
    const concl = validas.filter((x) => x.checkout_em && x.checkout_em.slice(0, 10) >= ini && x.checkout_em.slice(0, 10) <= fim);
    const estadia = concl.reduce((s, x) => s + Number(x.valor_estadia) - Number(x.desconto), 0);
    const consumos = concl.reduce((s, x) => s + Number(x.total_consumos), 0);
    return { dias, noitesOcup, capacidade, taxa: capacidade ? (noitesOcup / capacidade) * 100 : 0, recebido, estadia, consumos, porQuarto, nReservas: validas.filter((x) => x.checkin <= fim && x.checkout > ini).length, canceladas: c.reservas.filter((x) => x.estado === "cancelada" && x.checkin <= fim && x.checkout > ini).length };
  }, [c, ini, fim]);
  const linhas = c.quartos.map((q) => [q.numero, r.porQuarto[q.id] ?? 0, r.dias ? (((r.porQuarto[q.id] ?? 0) / r.dias) * 100).toFixed(1) + "%" : "0%"]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        <Button variant="outline" onClick={() => exportarCsv("ocupacao", ["Quarto", "Noites ocupadas", "Taxa"], linhas)}>Exportar CSV</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Taxa de ocupação", `${r.taxa.toFixed(1)}%`], ["Noites ocupadas", `${r.noitesOcup} / ${r.capacidade}`], ["Reservas no período", `${r.nReservas} (${r.canceladas} canceladas)`], ["Recebido no período", c.fmt(r.recebido)],
          ["Receita de estadias (check-outs)", c.fmt(r.estadia)], ["Receita de consumos (check-outs)", c.fmt(r.consumos)]].map(([k, v]) => (
          <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <Card><CardHeader><CardTitle className="text-base">Ocupação por quarto</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Quarto</TableHead><TableHead>Noites ocupadas</TableHead><TableHead>Taxa</TableHead></TableRow></TableHeader>
          <TableBody>{linhas.map((l) => <TableRow key={String(l[0])}>{l.map((v, i) => <TableCell key={i}>{v}</TableCell>)}</TableRow>)}</TableBody></Table>
      </CardContent></Card>
    </div>
  );
}
