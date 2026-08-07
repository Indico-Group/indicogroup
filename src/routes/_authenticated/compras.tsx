import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Trash2, Truck, Pencil, PackageCheck, XCircle, ShoppingBasket, Clock, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/use-empresa";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Aldeia Mesa" },
      { name: "description", content: "Ordens de compra, recepção de mercadoria e gestão de fornecedores do Aldeia Mesa." },
      { property: "og:title", content: "Compras — Aldeia Mesa" },
      { property: "og:description", content: "Crie ordens de compra, receba mercadoria e actualize o estoque automaticamente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComprasPage,
});

type CompraStatus = "rascunho" | "pendente" | "recebida" | "cancelada";

type Compra = {
  id: string;
  numero: number;
  fornecedor_id: string | null;
  status: CompraStatus;
  subtotal: number;
  desconto: number;
  total: number;
  documento: string | null;
  data_prevista: string | null;
  observacoes: string | null;
  recebida_em: string | null;
  created_at: string;
};

type Item = {
  produto_id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
};

const STATUS_META: Record<CompraStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  pendente: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  recebida: { label: "Recebida", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelada: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const fornecedorSchema = z.object({
  nome: z.string().trim().min(2, "Nome demasiado curto").max(120),
  contacto: z.string().trim().max(120).optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email("E-mail inválido").max(160).optional().nullable().or(z.literal(null)),
  morada: z.string().trim().max(240).optional().nullable(),
  is_active: z.boolean(),
});

function ComprasPage() {
  return (
    <div>
      <PageHeader
        title="Compras"
        description="Ordens de compra, recepção de mercadoria e fornecedores"
      />
      <Tabs defaultValue="ordens">
        <TabsList>
          <TabsTrigger value="ordens">Ordens de compra</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        </TabsList>
        <TabsContent value="ordens" className="mt-6">
          <OrdensTab />
        </TabsContent>
        <TabsContent value="fornecedores" className="mt-6">
          <FornecedoresTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Ordens ------------------------------- */

function OrdensTab() {
  const qc = useQueryClient();
  const { config } = useEmpresa();
  const moeda = config?.moeda ?? "MZN";
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)} ${moeda}`;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Compra | null>(null);
  const [detalhe, setDetalhe] = useState<Compra | null>(null);
  const [confirmar, setConfirmar] = useState<{ compra: Compra; accao: "recebida" | "cancelada" | "apagar" } | null>(null);

  const [form, setForm] = useState({
    fornecedor_id: "",
    documento: "",
    data_prevista: "",
    desconto: "",
    observacoes: "",
    status: "rascunho" as CompraStatus,
  });
  const [itens, setItens] = useState<Item[]>([]);
  const [novoItem, setNovoItem] = useState({ produto_id: "", quantidade: "1", preco_unitario: "" });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-lookup-compras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-lookup-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, unidade, preco_compra, estoque_atual")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Compra[];
    },
  });

  const { data: detalheItens = [] } = useQuery({
    queryKey: ["compra-itens", detalhe?.id],
    enabled: !!detalhe?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compra_itens")
        .select("*")
        .eq("compra_id", detalhe!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const produtoMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return compras.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (!t) return true;
      const forn = c.fornecedor_id ? (fornMap.get(c.fornecedor_id) ?? "").toLowerCase() : "";
      return String(c.numero).includes(t) || forn.includes(t) || (c.documento ?? "").toLowerCase().includes(t);
    });
  }, [compras, statusFilter, search, fornMap]);

  const stats = useMemo(() => {
    const pendentes = compras.filter((c) => c.status === "pendente" || c.status === "rascunho");
    const recebidas = compras.filter((c) => c.status === "recebida");
    return {
      total: compras.length,
      pendentes: pendentes.length,
      recebidas: recebidas.length,
      valorRecebido: recebidas.reduce((s, c) => s + Number(c.total), 0),
    };
  }, [compras]);

  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const total = Math.max(0, subtotal - (Number(form.desconto) || 0));

  const resetForm = () => {
    setForm({ fornecedor_id: "", documento: "", data_prevista: "", desconto: "", observacoes: "", status: "rascunho" });
    setItens([]);
    setNovoItem({ produto_id: "", quantidade: "1", preco_unitario: "" });
    setEditing(null);
  };

  const openNova = () => {
    resetForm();
    setOpen(true);
  };

  const openEditar = async (c: Compra) => {
    const { data } = await supabase.from("compra_itens").select("*").eq("compra_id", c.id).order("created_at");
    setEditing(c);
    setForm({
      fornecedor_id: c.fornecedor_id ?? "",
      documento: c.documento ?? "",
      data_prevista: c.data_prevista ?? "",
      desconto: c.desconto ? String(c.desconto) : "",
      observacoes: c.observacoes ?? "",
      status: c.status,
    });
    setItens(
      (data ?? []).map((i: any) => ({
        produto_id: i.produto_id,
        nome_produto: i.nome_produto,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
      })),
    );
    setOpen(true);
  };

  const adicionarItem = () => {
    const p = produtoMap.get(novoItem.produto_id);
    if (!p) return toast.error("Seleccione um produto");
    const qtd = Number(novoItem.quantidade);
    const preco = Number(novoItem.preco_unitario || p.preco_compra || 0);
    if (!qtd || qtd <= 0) return toast.error("Quantidade inválida");
    if (preco < 0) return toast.error("Preço inválido");
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantidade: copy[idx].quantidade + qtd, preco_unitario: preco };
        return copy;
      }
      return [...prev, { produto_id: p.id, nome_produto: p.nome, quantidade: qtd, preco_unitario: preco }];
    });
    setNovoItem({ produto_id: "", quantidade: "1", preco_unitario: "" });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) throw new Error("Adicione pelo menos um item");
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        fornecedor_id: form.fornecedor_id || null,
        documento: form.documento.trim() || null,
        data_prevista: form.data_prevista || null,
        desconto: Number(form.desconto) || 0,
        subtotal,
        total,
        observacoes: form.observacoes.trim() || null,
        user_id: u.user?.id ?? null,
      };

      let compraId: string;
      if (editing) {
        if (editing.status === "recebida" || editing.status === "cancelada") {
          throw new Error("Compras recebidas ou canceladas não podem ser editadas");
        }
        const { error } = await supabase.from("compras").update({ ...payload, status: form.status }).eq("id", editing.id);
        if (error) throw error;
        compraId = editing.id;
        await supabase.from("compra_itens").delete().eq("compra_id", compraId);
      } else {
        const { data, error } = await supabase
          .from("compras")
          .insert({ ...payload, status: form.status })
          .select("id")
          .single();
        if (error) throw error;
        compraId = data.id;
      }

      const { error: itensError } = await supabase.from("compra_itens").insert(
        itens.map((i) => ({
          compra_id: compraId,
          produto_id: i.produto_id,
          nome_produto: i.nome_produto,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          subtotal: i.quantidade * i.preco_unitario,
        })),
      );
      if (itensError) throw itensError;
    },
    onSuccess: () => {
      toast.success(editing ? "Ordem de compra actualizada" : "Ordem de compra criada");
      qc.invalidateQueries({ queryKey: ["compras"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao guardar"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ compra, status }: { compra: Compra; status: CompraStatus }) => {
      const { error } = await supabase.from("compras").update({ status }).eq("id", compra.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "recebida" ? "Compra recebida — estoque actualizado" : "Compra cancelada");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao actualizar estado"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (compra: Compra) => {
      if (compra.status === "recebida") throw new Error("Não é possível apagar uma compra recebida");
      const { error } = await supabase.from("compras").delete().eq("id", compra.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem de compra apagada");
      qc.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao apagar"),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingBasket} label="Ordens" value={String(stats.total)} />
        <StatCard icon={Clock} label="Por receber" value={String(stats.pendentes)} />
        <StatCard icon={PackageCheck} label="Recebidas" value={String(stats.recebidas)} />
        <StatCard icon={FileText} label="Valor recebido" value={fmt(stats.valorRecebido)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar por número, fornecedor ou documento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="recebida">Recebida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNova}>
          <Plus className="mr-2 h-4 w-4" /> Nova ordem
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Nº</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="hidden md:table-cell">Documento</TableHead>
                <TableHead className="hidden lg:table-cell">Prevista</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[190px] text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sem ordens de compra.</TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetalhe(c)}>
                  <TableCell className="font-mono text-sm">#{c.numero}</TableCell>
                  <TableCell className="font-medium">{c.fornecedor_id ? fornMap.get(c.fornecedor_id) ?? "—" : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.documento ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {c.data_prevista ? format(new Date(c.data_prevista), "dd MMM yyyy", { locale: pt }) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(Number(c.total))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_META[c.status].className}>{STATUS_META[c.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {(c.status === "rascunho" || c.status === "pendente") && (
                        <>
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditar(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" title="Receber mercadoria"
                            onClick={() => setConfirmar({ compra: c, accao: "recebida" })}
                          >
                            <PackageCheck className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" title="Cancelar"
                            onClick={() => setConfirmar({ compra: c, accao: "cancelada" })}
                          >
                            <XCircle className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" title="Apagar"
                            onClick={() => setConfirmar({ compra: c, accao: "apagar" })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {c.status === "recebida" && (
                        <Button
                          variant="ghost" size="icon" title="Cancelar e estornar"
                          onClick={() => setConfirmar({ compra: c, accao: "cancelada" })}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Formulário */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ordem #${editing.numero}` : "Nova ordem de compra"}</DialogTitle>
            <DialogDescription>
              Ao marcar como recebida, o estoque e o preço de compra dos produtos são actualizados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select
                value={form.fornecedor_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, fornecedor_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem fornecedor —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Documento / Factura</Label>
              <Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} placeholder="Ex.: FT 2026/145" />
            </div>
            <div className="space-y-2">
              <Label>Data prevista</Label>
              <Input type="date" value={form.data_prevista} onChange={(e) => setForm((f) => ({ ...f, data_prevista: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CompraStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Itens</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_100px_130px_auto]">
              <Select
                value={novoItem.produto_id}
                onValueChange={(v) => {
                  const p = produtoMap.get(v);
                  setNovoItem((n) => ({
                    ...n,
                    produto_id: v,
                    preco_unitario: n.preco_unitario || String(p?.preco_compra ?? ""),
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.unidade})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number" min="0" step="0.001" placeholder="Qtd"
                value={novoItem.quantidade}
                onChange={(e) => setNovoItem((n) => ({ ...n, quantidade: e.target.value }))}
              />
              <Input
                type="number" min="0" step="0.01" placeholder="Preço"
                value={novoItem.preco_unitario}
                onChange={(e) => setNovoItem((n) => ({ ...n, preco_unitario: e.target.value }))}
              />
              <Button type="button" variant="secondary" onClick={adicionarItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {itens.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.produto_id}>
                      <TableCell>{i.nome_produto}</TableCell>
                      <TableCell className="text-right">{i.quantidade}</TableCell>
                      <TableCell className="text-right">{fmt(i.preco_unitario)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(i.quantidade * i.preco_unitario)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => setItens((prev) => prev.filter((x) => x.produto_id !== i.produto_id))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Desconto</Label>
              <Input type="number" min="0" step="0.01" value={form.desconto} onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Subtotal {fmt(subtotal)}</span>
            <span className="text-lg font-bold">Total {fmt(total)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ordem de compra #{detalhe?.numero}</DialogTitle>
            <DialogDescription>
              {detalhe?.fornecedor_id ? fornMap.get(detalhe.fornecedor_id) : "Sem fornecedor"} ·{" "}
              {detalhe && format(new Date(detalhe.created_at), "dd MMM yyyy HH:mm", { locale: pt })}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalheItens.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.nome_produto}</TableCell>
                  <TableCell className="text-right">{Number(i.quantidade)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(i.preco_unitario))}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(i.subtotal))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(Number(detalhe?.subtotal ?? 0))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{fmt(Number(detalhe?.desconto ?? 0))}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{fmt(Number(detalhe?.total ?? 0))}</span></div>
          </div>
          {detalhe?.observacoes && <p className="text-sm text-muted-foreground">{detalhe.observacoes}</p>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.accao === "recebida" && "Receber mercadoria?"}
              {confirmar?.accao === "cancelada" && "Cancelar ordem de compra?"}
              {confirmar?.accao === "apagar" && "Apagar ordem de compra?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.accao === "recebida" && "O estoque dos produtos será aumentado e o preço de compra actualizado."}
              {confirmar?.accao === "cancelada" && (confirmar.compra.status === "recebida"
                ? "O estoque recebido será estornado."
                : "A ordem deixa de estar activa.")}
              {confirmar?.accao === "apagar" && "Esta acção é irreversível."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmar) return;
                if (confirmar.accao === "apagar") deleteMutation.mutate(confirmar.compra);
                else statusMutation.mutate({ compra: confirmar.compra, status: confirmar.accao });
                setConfirmar(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ----------------------------- Fornecedores ---------------------------- */

function FornecedoresTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [form, setForm] = useState({
    nome: "", contacto: "", telefone: "", email: "", morada: "", is_active: true,
  });

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-por-fornecedor"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, fornecedor_id");
      if (error) throw error;
      return data;
    },
  });

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    produtos.forEach((p: any) => {
      if (p.fornecedor_id) m.set(p.fornecedor_id, (m.get(p.fornecedor_id) ?? 0) + 1);
    });
    return m;
  }, [produtos]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return fornecedores;
    return fornecedores.filter((f: any) =>
      f.nome.toLowerCase().includes(t) ||
      (f.telefone ?? "").toLowerCase().includes(t) ||
      (f.email ?? "").toLowerCase().includes(t));
  }, [fornecedores, search]);

  const openNovo = () => {
    setEditing(null);
    setForm({ nome: "", contacto: "", telefone: "", email: "", morada: "", is_active: true });
    setOpen(true);
  };

  const openEditar = (f: any) => {
    setEditing(f);
    setForm({
      nome: f.nome, contacto: f.contacto ?? "", telefone: f.telefone ?? "",
      email: f.email ?? "", morada: f.morada ?? "", is_active: f.is_active,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = fornecedorSchema.parse({
        nome: form.nome,
        contacto: form.contacto.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        morada: form.morada.trim() || null,
        is_active: form.is_active,
      });
      if (editing) {
        const { error } = await supabase.from("fornecedores").update(parsed).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(parsed);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Fornecedor actualizado" : "Fornecedor criado");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["fornecedores-lookup-compras"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.errors?.[0]?.message ?? e.message ?? "Erro ao guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (f: any) => {
      if ((contagem.get(f.id) ?? 0) > 0) throw new Error("Fornecedor com produtos associados não pode ser apagado");
      const { error } = await supabase.from("fornecedores").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor apagado");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao apagar"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Pesquisar fornecedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNovo}><Plus className="mr-2 h-4 w-4" /> Novo fornecedor</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                <TableHead className="text-center">Produtos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24 text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sem fornecedores registados.</TableCell></TableRow>
              )}
              {filtered.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      {f.nome}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.contacto ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{f.telefone ?? "—"}</TableCell>
                  <TableCell className="text-center">{contagem.get(f.id) ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={f.is_active
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted text-muted-foreground"}>
                      {f.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditar(f)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
            <DialogDescription>Dados de contacto usados nas ordens de compra.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pessoa de contacto</Label>
                <Input value={form.contacto} onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Morada</Label>
              <Textarea rows={2} value={form.morada} onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Fornecedor activo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMutation.mutate(toDelete); setToDelete(null); }}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
