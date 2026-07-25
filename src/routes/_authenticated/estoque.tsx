import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Sliders, Plus, Search, History,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Aldeia Mesa" },
      { name: "description", content: "Histórico de movimentos de estoque: compras, vendas, ajustes e transferências." },
    ],
  }),
  component: EstoquePage,
});

type MovimentoTipo = "compra" | "venda" | "ajuste" | "transferencia_entrada" | "transferencia_saida";

type Movimento = {
  id: string;
  produto_id: string;
  tipo: MovimentoTipo;
  quantidade: number;
  estoque_anterior: number;
  estoque_novo: number;
  motivo: string | null;
  referencia: string | null;
  user_id: string | null;
  created_at: string;
};

const TIPO_META: Record<MovimentoTipo, { label: string; color: string; icon: any; sign: 1 | -1 | 0 }> = {
  compra: { label: "Compra", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: ArrowDownCircle, sign: 1 },
  venda: { label: "Venda", color: "text-blue-600 bg-blue-500/10 border-blue-500/20", icon: ArrowUpCircle, sign: -1 },
  ajuste: { label: "Ajuste", color: "text-amber-600 bg-amber-500/10 border-amber-500/20", icon: Sliders, sign: 0 },
  transferencia_entrada: { label: "Transf. entrada", color: "text-teal-600 bg-teal-500/10 border-teal-500/20", icon: ArrowLeftRight, sign: 1 },
  transferencia_saida: { label: "Transf. saída", color: "text-orange-600 bg-orange-500/10 border-orange-500/20", icon: ArrowLeftRight, sign: -1 },
};

const schema = z.object({
  produto_id: z.string().uuid("Seleccione um produto"),
  tipo: z.enum(["compra", "venda", "ajuste", "transferencia_entrada", "transferencia_saida"]),
  quantidade: z.number().refine((n) => n !== 0, "Quantidade não pode ser 0"),
  motivo: z.string().trim().max(300).optional().nullable(),
  referencia: z.string().trim().max(100).optional().nullable(),
});

function EstoquePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [produtoFilter, setProdutoFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto_id: "",
    tipo: "ajuste" as MovimentoTipo,
    quantidade: "",
    motivo: "",
    referencia: "",
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-lookup-mov"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos")
        .select("id, nome, unidade, estoque_atual").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: movimentos = [], isLoading } = useQuery({
    queryKey: ["movimentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("movimentos_estoque")
        .select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Movimento[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-lookup-mov"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) return [];
      return data;
    },
  });

  const produtoMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const userMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name])), [profiles]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return movimentos.filter((m) => {
      if (tipoFilter !== "todos" && m.tipo !== tipoFilter) return false;
      if (produtoFilter !== "todos" && m.produto_id !== produtoFilter) return false;
      if (t) {
        const nome = produtoMap.get(m.produto_id)?.nome?.toLowerCase() ?? "";
        return nome.includes(t) || m.motivo?.toLowerCase().includes(t) || m.referencia?.toLowerCase().includes(t);
      }
      return true;
    });
  }, [movimentos, tipoFilter, produtoFilter, search, produtoMap]);

  const stats = useMemo(() => {
    return {
      total: movimentos.length,
      entradas: movimentos.filter((m) => TIPO_META[m.tipo].sign === 1).length,
      saidas: movimentos.filter((m) => TIPO_META[m.tipo].sign === -1).length,
      ajustes: movimentos.filter((m) => m.tipo === "ajuste").length,
    };
  }, [movimentos]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const qtd = Number(form.quantidade);
      const parsed = schema.parse({
        produto_id: form.produto_id,
        tipo: form.tipo,
        quantidade: qtd,
        motivo: form.motivo.trim() || null,
        referencia: form.referencia.trim() || null,
      });
      // trigger calcula estoque_anterior/novo — passamos 0 apenas para satisfazer NOT NULL
      const { error } = await supabase.from("movimentos_estoque").insert({
        ...parsed,
        estoque_anterior: 0,
        estoque_novo: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimentos"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos-lookup-mov"] });
      toast.success("Movimento registado");
      setOpen(false);
      setForm({ produto_id: "", tipo: "ajuste", quantidade: "", motivo: "", referencia: "" });
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.errors[0].message);
      else toast.error(e.message || "Erro ao registar movimento");
    },
  });

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Histórico completo de movimentações"
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Movimento
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total de movimentos" value={stats.total} />
        <StatCard label="Entradas" value={stats.entradas} tone="emerald" />
        <StatCard label="Saídas" value={stats.saidas} tone="blue" />
        <StatCard label="Ajustes" value={stats.ajustes} tone="amber" />
      </div>

      <Card className="mb-4">
        <CardContent className="grid gap-3 py-4 md:grid-cols-[1fr_200px_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto, motivo ou referência..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TIPO_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={produtoFilter} onValueChange={setProdutoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Anterior → Novo</TableHead>
                  <TableHead>Motivo / Ref.</TableHead>
                  <TableHead>Utilizador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">A carregar...</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <History className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      Nenhum movimento registado
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((m) => {
                  const meta = TIPO_META[m.tipo];
                  const Icon = meta.icon;
                  const prod = produtoMap.get(m.produto_id);
                  const date = new Date(m.created_at);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">{date.toLocaleDateString("pt-PT")} {date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true, locale: pt })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={"gap-1 " + meta.color}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{prod?.nome ?? "—"}</TableCell>
                      <TableCell className={"text-right tabular-nums font-medium " +
                        (meta.sign === 1 ? "text-emerald-600" : meta.sign === -1 ? "text-blue-600" : "text-amber-600")}>
                        {meta.sign === 1 ? "+" : meta.sign === -1 ? "−" : ""}
                        {Math.abs(m.quantidade)} {prod?.unidade ?? ""}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {m.estoque_anterior} → <span className="font-medium text-foreground">{m.estoque_novo}</span>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="truncate text-sm">{m.motivo ?? "—"}</div>
                        {m.referencia && <div className="truncate text-xs text-muted-foreground">Ref: {m.referencia}</div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.user_id ? (userMap.get(m.user_id) ?? "—") : "Sistema"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Movimento de Estoque</DialogTitle>
            <DialogDescription>
              Registe uma entrada, saída, ajuste ou transferência. O estoque do produto é actualizado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Produto *</Label>
              <Select value={form.produto_id} onValueChange={(v) => setForm((f) => ({ ...f, produto_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} <span className="text-muted-foreground">({p.estoque_atual} {p.unidade})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as MovimentoTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>
                Quantidade *
                {form.tipo === "ajuste" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (use valor negativo para reduzir)
                  </span>
                )}
              </Label>
              <Input
                type="number"
                step="0.001"
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                placeholder={form.tipo === "ajuste" ? "ex: -3 ou 5" : "ex: 10"}
              />
            </div>

            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Textarea
                rows={2}
                value={form.motivo}
                onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="ex: Recepção de encomenda, quebra, inventário..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Referência</Label>
              <Input
                value={form.referencia}
                onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="ex: Nº factura, guia de transporte..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "A registar..." : "Registar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "blue" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : tone === "blue" ? "text-blue-600" : tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={"mt-1 text-2xl font-bold tabular-nums " + toneClass}>{value}</div>
      </CardContent>
    </Card>
  );
}
