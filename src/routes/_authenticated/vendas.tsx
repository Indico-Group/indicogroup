import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Minus, Trash2, Search, ShoppingCart, Package, Receipt, X,
  CheckCircle2, XCircle, Clock, Printer, User as UserIcon, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/use-empresa";
import {
  getEmpresaDoc, criarReciboPdf, criarRelatorioPdf, imprimirPdf, nomeFicheiro, moeda,
  type ReciboItem, type ReciboVenda,
} from "@/lib/pdf";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — Aldeia Mesa" },
      { name: "description", content: "Frente de caixa (PDV) do bar e restaurante Aldeia Mesa: vendas rápidas, mesas, delivery e pagamentos." },
    ],
  }),
  component: VendasPage,
});

type Produto = {
  id: string;
  nome: string;
  codigo: string | null;
  codigo_barras: string | null;
  preco_venda: number;
  estoque_atual: number;
  unidade: string;
  categoria_id: string | null;
  is_active: boolean;
};

type CartItem = {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  desconto: number;
  unidade: string;
  estoque: number;
};

type Cliente = { id: string; nome: string; telefone: string | null };

type VendaTipo = "balcao" | "mesa" | "delivery";
type VendaStatus = "aberta" | "paga" | "cancelada";
type Metodo = "dinheiro" | "mpesa" | "emola" | "pos" | "transferencia" | "misto";

type Venda = {
  id: string;
  numero: number;
  cliente_id: string | null;
  tipo: VendaTipo;
  mesa: string | null;
  subtotal: number;
  desconto: number;
  acrescimo: number;
  total: number;
  status: VendaStatus;
  metodo_pagamento: Metodo | null;
  observacoes: string | null;
  user_id: string | null;
  paga_em: string | null;
  cancelada_em: string | null;
  created_at: string;
};

const METODOS: { value: Metodo; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "emola", label: "e-Mola" },
  { value: "pos", label: "POS / Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "misto", label: "Misto" },
];

function formatMZN(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" }).format(v || 0);
}

function VendasPage() {
  return (
    <div>
      <PageHeader title="Vendas" description="Frente de caixa (PDV) e histórico de vendas" />
      <Tabs defaultValue="pdv" className="w-full">
        <TabsList>
          <TabsTrigger value="pdv"><ShoppingCart className="mr-2 h-4 w-4" />PDV</TabsTrigger>
          <TabsTrigger value="historico"><Receipt className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="pdv" className="mt-4">
          <PDV />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <Historico />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================= PDV ============================= */

function PDV() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tipo, setTipo] = useState<VendaTipo>("balcao");
  const [mesa, setMesa] = useState("");
  const [clienteId, setClienteId] = useState<string>("nenhum");
  const [descontoGlobal, setDescontoGlobal] = useState("0");
  const [acrescimo, setAcrescimo] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [referenciaPag, setReferenciaPag] = useState("");
  const [saving, setSaving] = useState(false);
  const [ultimaVenda, setUltimaVenda] = useState<{ venda: Venda; itens: CartItem[] } | null>(null);

  const { data: produtos = [] } = useQuery({
    queryKey: ["pdv-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, codigo, codigo_barras, preco_venda, estoque_atual, unidade, categoria_id, is_active")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["pdv-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("id, nome, cor").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; cor: string | null }[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["pdv-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome, telefone").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return produtos.filter((p) => {
      if (catFilter !== "todas" && p.categoria_id !== catFilter) return false;
      if (!t) return true;
      return (
        p.nome.toLowerCase().includes(t) ||
        p.codigo?.toLowerCase().includes(t) ||
        p.codigo_barras?.toLowerCase().includes(t)
      );
    });
  }, [produtos, search, catFilter]);

  const addToCart = (p: Produto) => {
    if (p.estoque_atual <= 0) {
      toast.error(`${p.nome} sem estoque`);
      return;
    }
    setCart((prev) => {
      const exists = prev.find((i) => i.produto_id === p.id);
      if (exists) {
        if (exists.quantidade + 1 > p.estoque_atual) {
          toast.error("Quantidade excede estoque");
          return prev;
        }
        return prev.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          produto_id: p.id,
          nome: p.nome,
          preco: Number(p.preco_venda),
          quantidade: 1,
          desconto: 0,
          unidade: p.unidade,
          estoque: Number(p.estoque_atual),
        },
      ];
    });
  };

  const setQty = (id: string, q: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.produto_id !== id) return i;
          if (q > i.estoque) {
            toast.error("Quantidade excede estoque");
            return i;
          }
          return { ...i, quantidade: Math.max(0, q) };
        })
        .filter((i) => i.quantidade > 0),
    );
  };

  const removeItem = (id: string) => setCart((p) => p.filter((i) => i.produto_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.preco * i.quantidade - i.desconto, 0);
  const descontoNum = Math.max(0, Number(descontoGlobal) || 0);
  const acrescimoNum = Math.max(0, Number(acrescimo) || 0);
  const total = Math.max(0, subtotal - descontoNum + acrescimoNum);
  const recebido = Number(valorRecebido) || 0;
  const troco = metodo === "dinheiro" ? Math.max(0, recebido - total) : 0;

  const clear = () => {
    setCart([]);
    setDescontoGlobal("0");
    setAcrescimo("0");
    setObservacoes("");
    setMesa("");
    setClienteId("nenhum");
    setTipo("balcao");
    setValorRecebido("");
    setReferenciaPag("");
    setMetodo("dinheiro");
  };

  const finalizar = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Carrinho vazio");
      if (tipo === "mesa" && !mesa.trim()) throw new Error("Informe a mesa");
      if (metodo === "dinheiro" && recebido < total) throw new Error("Valor recebido insuficiente");

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      // 1) Cria venda como 'aberta'
      const { data: venda, error: e1 } = await supabase
        .from("vendas")
        .insert({
          cliente_id: clienteId === "nenhum" ? null : clienteId,
          tipo,
          mesa: tipo === "mesa" ? mesa.trim() : null,
          subtotal,
          desconto: descontoNum,
          acrescimo: acrescimoNum,
          total,
          status: "aberta",
          metodo_pagamento: metodo,
          observacoes: observacoes.trim() || null,
          user_id: uid,
        })
        .select()
        .single();
      if (e1) throw e1;

      // 2) Itens
      const itensPayload = cart.map((i) => ({
        venda_id: venda.id,
        produto_id: i.produto_id,
        nome_produto: i.nome,
        quantidade: i.quantidade,
        preco_unitario: i.preco,
        desconto: i.desconto,
        subtotal: i.preco * i.quantidade - i.desconto,
      }));
      const { error: e2 } = await supabase.from("venda_itens").insert(itensPayload);
      if (e2) throw e2;

      // 3) Pagamento
      const { error: e3 } = await supabase.from("venda_pagamentos").insert({
        venda_id: venda.id,
        metodo,
        valor: total,
        referencia: referenciaPag.trim() || null,
      });
      if (e3) throw e3;

      // 4) Marca como paga (dispara baixa de estoque via trigger)
      const { data: paga, error: e4 } = await supabase
        .from("vendas")
        .update({ status: "paga" })
        .eq("id", venda.id)
        .select()
        .single();
      if (e4) throw e4;

      return { venda: paga as Venda, itens: [...cart] };
    },
    onSuccess: (res) => {
      toast.success(`Venda #${res.venda.numero} concluída`);
      setUltimaVenda(res);
      setCheckoutOpen(false);
      setCartOpen(false);
      clear();
      qc.invalidateQueries({ queryKey: ["pdv-produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["movimentos_estoque"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar venda";
      toast.error(msg);
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      {/* Grade de produtos */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, código ou código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="lg:hidden" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Carrinho ({cart.length})
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const sem = p.estoque_atual <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={sem}
                className="group flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  <Package className="h-4 w-4" />
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{p.nome}</div>
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-primary">{formatMZN(p.preco_venda)}</span>
                  <Badge variant={sem ? "destructive" : "secondary"} className="text-[10px]">
                    {p.estoque_atual} {p.unidade}
                  </Badge>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado
            </div>
          )}
        </div>
      </div>

      {/* Carrinho desktop */}
      <div className="hidden lg:block">
        <CartPanel
          cart={cart}
          tipo={tipo}
          setTipo={setTipo}
          mesa={mesa}
          setMesa={setMesa}
          clienteId={clienteId}
          setClienteId={setClienteId}
          clientes={clientes}
          descontoGlobal={descontoGlobal}
          setDescontoGlobal={setDescontoGlobal}
          acrescimo={acrescimo}
          setAcrescimo={setAcrescimo}
          subtotal={subtotal}
          total={total}
          setQty={setQty}
          removeItem={removeItem}
          onCheckout={() => setCheckoutOpen(true)}
          onClear={clear}
        />
      </div>

      {/* Carrinho mobile (sheet-like dialog) */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto p-0">
          <div className="p-4">
            <CartPanel
              cart={cart}
              tipo={tipo}
              setTipo={setTipo}
              mesa={mesa}
              setMesa={setMesa}
              clienteId={clienteId}
              setClienteId={setClienteId}
              clientes={clientes}
              descontoGlobal={descontoGlobal}
              setDescontoGlobal={setDescontoGlobal}
              acrescimo={acrescimo}
              setAcrescimo={setAcrescimo}
              subtotal={subtotal}
              total={total}
              setQty={setQty}
              removeItem={removeItem}
              onCheckout={() => setCheckoutOpen(true)}
              onClear={clear}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar venda</DialogTitle>
            <DialogDescription>
              Total a pagar: <span className="font-semibold text-foreground">{formatMZN(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Método de pagamento</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as Metodo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {metodo === "dinheiro" && (
              <div>
                <Label>Valor recebido (MZN)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  placeholder={String(total.toFixed(2))}
                />
                {recebido > 0 && (
                  <p className="mt-1 text-sm">
                    Troco: <span className="font-semibold text-primary">{formatMZN(troco)}</span>
                  </p>
                )}
              </div>
            )}

            {metodo !== "dinheiro" && (
              <div>
                <Label>Referência / Nº transacção</Label>
                <Input
                  value={referenciaPag}
                  onChange={(e) => setReferenciaPag(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending}
              className="bg-gradient-gold text-gold-foreground hover:opacity-90"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {finalizar.isPending ? "A processar..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprovante */}
      {ultimaVenda && (
        <Dialog open={!!ultimaVenda} onOpenChange={(o) => !o && setUltimaVenda(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Comprovante</DialogTitle>
            </DialogHeader>
            <Receipt2 venda={ultimaVenda.venda} itens={ultimaVenda.itens} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setUltimaVenda(null)}>Fechar</Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />Imprimir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ========================== CART PANEL ========================== */

function CartPanel(props: {
  cart: CartItem[];
  tipo: VendaTipo;
  setTipo: (v: VendaTipo) => void;
  mesa: string;
  setMesa: (v: string) => void;
  clienteId: string;
  setClienteId: (v: string) => void;
  clientes: Cliente[];
  descontoGlobal: string;
  setDescontoGlobal: (v: string) => void;
  acrescimo: string;
  setAcrescimo: (v: string) => void;
  subtotal: number;
  total: number;
  setQty: (id: string, q: number) => void;
  removeItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}) {
  const {
    cart, tipo, setTipo, mesa, setMesa, clienteId, setClienteId, clientes,
    descontoGlobal, setDescontoGlobal, acrescimo, setAcrescimo,
    subtotal, total, setQty, removeItem, onCheckout, onClear,
  } = props;

  return (
    <Card className="sticky top-4">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-4 w-4 text-primary" /> Carrinho
          </h3>
          {cart.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              <X className="mr-1 h-3 w-3" />Limpar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(["balcao", "mesa", "delivery"] as VendaTipo[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tipo === t ? "default" : "outline"}
              onClick={() => setTipo(t)}
              className="capitalize"
            >
              {t === "balcao" ? "Balcão" : t === "mesa" ? "Mesa" : "Delivery"}
            </Button>
          ))}
        </div>

        {tipo === "mesa" && (
          <div>
            <Label className="text-xs">Nº da mesa</Label>
            <Input value={mesa} onChange={(e) => setMesa(e.target.value)} placeholder="Ex.: 5" />
          </div>
        )}

        <div>
          <Label className="text-xs">Cliente (opcional)</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem cliente</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <ScrollArea className="h-[280px] pr-2">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carrinho vazio</p>
          ) : (
            <div className="space-y-2">
              {cart.map((i) => (
                <div key={i.produto_id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatMZN(i.preco)} / {i.unidade}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(i.produto_id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setQty(i.produto_id, i.quantidade - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={i.quantidade}
                        onChange={(e) => setQty(i.produto_id, Number(e.target.value))}
                        className="h-6 w-14 text-center text-xs"
                      />
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setQty(i.produto_id, i.quantidade + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-semibold">{formatMZN(i.preco * i.quantidade - i.desconto)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Desconto (MZN)</Label>
            <Input type="number" step="0.01" value={descontoGlobal} onChange={(e) => setDescontoGlobal(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Acréscimo (MZN)</Label>
            <Input type="number" step="0.01" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMZN(subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground">
            <span>Desconto</span><span>-{formatMZN(Number(descontoGlobal) || 0)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Acréscimo</span><span>+{formatMZN(Number(acrescimo) || 0)}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between text-base font-bold text-primary">
            <span>Total</span><span>{formatMZN(total)}</span>
          </div>
        </div>

        <Button
          className="w-full bg-gradient-gold text-gold-foreground hover:opacity-90"
          disabled={cart.length === 0}
          onClick={onCheckout}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar venda
        </Button>
      </CardContent>
    </Card>
  );
}

/* ============================ RECEIPT ============================ */

function Receipt2({ venda, itens }: { venda: Venda; itens: CartItem[] }) {
  const { config, logoUrl } = useEmpresa();
  const nome = config?.nome_empresa ?? "Aldeia Mesa";
  const prefixo = config?.prefixo_recibo ?? "AM";

  return (
    <div className="space-y-2 rounded-md border bg-card p-4 font-mono text-xs">
      <div className="space-y-1 text-center">
        {logoUrl && (
          <img src={logoUrl} alt={`Logotipo ${nome}`} className="mx-auto h-14 w-auto object-contain" />
        )}
        <p className="text-sm font-bold uppercase">{nome}</p>
        {config?.nif && <p className="text-muted-foreground">NUIT: {config.nif}</p>}
        {config?.morada && <p className="text-muted-foreground">{config.morada}</p>}
        {config?.telefone && <p className="text-muted-foreground">{config.telefone}</p>}
        <p className="text-muted-foreground">Comprovante de venda</p>
        {config?.mensagem_recibo && <p className="text-muted-foreground">{config.mensagem_recibo}</p>}
      </div>
      <Separator />
      <div className="flex justify-between"><span>Nº</span><span>{prefixo}-{venda.numero}</span></div>
      <div className="flex justify-between">
        <span>Data</span>
        <span>{format(new Date(venda.created_at), "dd/MM/yy HH:mm")}</span>
      </div>
      <div className="flex justify-between"><span>Tipo</span><span className="capitalize">{venda.tipo}</span></div>
      {venda.mesa && <div className="flex justify-between"><span>Mesa</span><span>{venda.mesa}</span></div>}
      <Separator />
      {itens.map((i) => (
        <div key={i.produto_id}>
          <p>{i.nome}</p>
          <div className="flex justify-between text-muted-foreground">
            <span>{i.quantidade} x {formatMZN(i.preco)}</span>
            <span>{formatMZN(i.preco * i.quantidade - i.desconto)}</span>
          </div>
        </div>
      ))}
      <Separator />
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatMZN(venda.total)}</span></div>
      <div className="flex justify-between"><span>Pagamento</span><span className="capitalize">{venda.metodo_pagamento}</span></div>
      <Separator />
      <p className="text-center text-muted-foreground">{config?.rodape_recibo || "Obrigado pela preferência!"}</p>
    </div>
  );
}


/* =========================== HISTÓRICO =========================== */

function Historico() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [detalhe, setDetalhe] = useState<Venda | null>(null);
  const [cancelar, setCancelar] = useState<Venda | null>(null);

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Venda[];
    },
  });

  const { data: itensDetalhe = [] } = useQuery({
    queryKey: ["venda-itens", detalhe?.id],
    enabled: !!detalhe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_itens")
        .select("*")
        .eq("venda_id", detalhe!.id);
      if (error) throw error;
      return data as {
        id: string; nome_produto: string; quantidade: number; preco_unitario: number; desconto: number; subtotal: number;
      }[];
    },
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return vendas.filter((v) => {
      if (statusFilter !== "todas" && v.status !== statusFilter) return false;
      if (!t) return true;
      return (
        String(v.numero).includes(t) ||
        v.mesa?.toLowerCase().includes(t) ||
        v.observacoes?.toLowerCase().includes(t)
      );
    });
  }, [vendas, search, statusFilter]);

  const stats = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const doDia = vendas.filter((v) => v.status === "paga" && new Date(v.created_at) >= hoje);
    return {
      totalDia: doDia.reduce((s, v) => s + Number(v.total), 0),
      qtdDia: doDia.length,
      abertas: vendas.filter((v) => v.status === "aberta").length,
      canceladas: vendas.filter((v) => v.status === "cancelada").length,
    };
  }, [vendas]);

  const doCancelar = useMutation({
    mutationFn: async (v: Venda) => {
      const { error } = await supabase.from("vendas").update({ status: "cancelada" }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda cancelada");
      setCancelar(null);
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["pdv-produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentos_estoque"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Erro ao cancelar"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Vendas hoje" value={formatMZN(stats.totalDia)} sub={`${stats.qtdDia} venda(s)`} tone="primary" />
        <StatCard label="Abertas" value={String(stats.abertas)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Canceladas" value={String(stats.canceladas)} icon={<XCircle className="h-4 w-4" />} tone="destructive" />
        <StatCard label="Total registos" value={String(vendas.length)} icon={<Receipt className="h-4 w-4" />} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar por nº, mesa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos estados</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pag.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">A carregar...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
                ) : filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-semibold">#{v.numero}</TableCell>
                    <TableCell className="text-sm">
                      <div>{format(new Date(v.created_at), "dd/MM HH:mm")}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(v.created_at), { locale: pt, addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {v.tipo}{v.mesa ? ` · ${v.mesa}` : ""}
                    </TableCell>
                    <TableCell className="font-semibold">{formatMZN(Number(v.total))}</TableCell>
                    <TableCell className="text-sm capitalize">{v.metodo_pagamento ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={v.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetalhe(v)}>Ver</Button>
                      {v.status !== "cancelada" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelar(v)}>
                          Cancelar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Venda #{detalhe?.numero}</DialogTitle>
            <DialogDescription>
              {detalhe && format(new Date(detalhe.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: pt })}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
                <div><span className="text-muted-foreground">Tipo: </span><span className="capitalize font-medium">{detalhe.tipo}</span></div>
                {detalhe.mesa && <div><span className="text-muted-foreground">Mesa: </span>{detalhe.mesa}</div>}
                <div><span className="text-muted-foreground">Estado: </span><StatusBadge status={detalhe.status} /></div>
                <div><span className="text-muted-foreground">Pag.: </span><span className="capitalize">{detalhe.metodo_pagamento ?? "-"}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Itens</p>
                {itensDetalhe.map((it) => (
                  <div key={it.id} className="flex justify-between border-b py-1">
                    <span>{it.nome_produto} × {it.quantidade}</span>
                    <span>{formatMZN(Number(it.subtotal))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMZN(Number(detalhe.subtotal))}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span>-{formatMZN(Number(detalhe.desconto))}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Acréscimo</span><span>+{formatMZN(Number(detalhe.acrescimo))}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-primary"><span>Total</span><span>{formatMZN(Number(detalhe.total))}</span></div>
              </div>
              {detalhe.observacoes && (
                <div className="rounded-md border p-2 text-xs">
                  <span className="font-medium">Obs.: </span>{detalhe.observacoes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda #{cancelar?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda será marcada como cancelada. Se estava paga, os itens serão estornados ao estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelar && doCancelar.mutate(cancelar)}
            >
              Cancelar venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label, value, sub, icon, tone,
}: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: "primary" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <p className={`mt-1 text-xl font-bold ${tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: VendaStatus }) {
  if (status === "paga") return <Badge className="bg-green-600 text-white hover:bg-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Paga</Badge>;
  if (status === "aberta") return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Aberta</Badge>;
  return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
}
