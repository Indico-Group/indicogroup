import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Trash2, Pencil, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Wallet, AlertTriangle, FileDown, Printer, Sheet as SheetIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { registarAuditoria, exportarCsv } from "@/lib/auditoria";
import { getEmpresaDoc, criarRelatorioPdf, imprimirPdf, nomeFicheiro } from "@/lib/pdf";
import { useEmpresa } from "@/hooks/use-empresa";
import { PageHeader } from "@/components/page-header";
import { RequireAccess } from "@/components/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Aldeia Mesa" },
      { name: "description", content: "Contas a pagar e a receber, receitas, despesas e fluxo de caixa do Aldeia Mesa." },
      { property: "og:title", content: "Financeiro — Aldeia Mesa" },
      { property: "og:description", content: "Controle receitas, despesas, contas a pagar e a receber com fluxo de caixa consolidado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

type Tipo = "receita" | "despesa";
type Status = "pendente" | "pago" | "cancelado";
type Metodo = "dinheiro" | "mpesa" | "emola" | "pos" | "transferencia" | "misto";

type Categoria = { id: string; nome: string; tipo: Tipo; cor: string | null; is_active: boolean };

type Lancamento = {
  id: string;
  descricao: string;
  tipo: Tipo;
  status: Status;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  metodo: Metodo | null;
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  documento: string | null;
  observacoes: string | null;
  created_at: string;
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  pago: { label: "Liquidado", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const METODOS: { value: Metodo; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "emola", label: "e-Mola" },
  { value: "pos", label: "POS / Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "misto", label: "Misto" },
];

const NENHUM = "__nenhum__";

const lancamentoSchema = z.object({
  descricao: z.string().trim().min(2, "Descrição demasiado curta").max(160),
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive("O valor deve ser maior que zero"),
  vencimento: z.string().min(8, "Data inválida"),
  documento: z.string().trim().max(60).nullable(),
  observacoes: z.string().trim().max(400).nullable(),
});

const categoriaSchema = z.object({
  nome: z.string().trim().min(2, "Nome demasiado curto").max(80),
  tipo: z.enum(["receita", "despesa"]),
});

function fmt(v: number, cur: string) {
  return `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)} ${cur}`;
}

function dataCurta(v?: string | null) {
  if (!v) return "—";
  try {
    return format(parseISO(v), "dd/MM/yyyy", { locale: pt });
  } catch {
    return v;
  }
}

function FinanceiroPage() {
  return (
    <RequireAccess path="/financeiro">
      <div>
        <PageHeader
          title="Financeiro"
          description="Receitas, despesas, contas a pagar e a receber e fluxo de caixa"
        />
        <Tabs defaultValue="lancamentos">
          <TabsList>
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="lancamentos" className="mt-6">
            <LancamentosTab />
          </TabsContent>
          <TabsContent value="fluxo" className="mt-6">
            <FluxoTab />
          </TabsContent>
          <TabsContent value="categorias" className="mt-6">
            <CategoriasTab />
          </TabsContent>
        </Tabs>
      </div>
    </RequireAccess>
  );
}

/* ---------------------------- consultas base ---------------------------- */

function useCategorias() {
  return useQuery({
    queryKey: ["fin-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_categorias")
        .select("id, nome, tipo, cor, is_active")
        .order("tipo")
        .order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

function useLancamentos() {
  return useQuery({
    queryKey: ["fin-lancamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("*")
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });
}

/* ----------------------------- Lançamentos ----------------------------- */

type FormState = {
  id: string | null;
  descricao: string;
  tipo: Tipo;
  status: Status;
  valor: string;
  vencimento: string;
  metodo: string;
  categoria_id: string;
  cliente_id: string;
  fornecedor_id: string;
  documento: string;
  observacoes: string;
};

const formVazio = (tipo: Tipo = "despesa"): FormState => ({
  id: null,
  descricao: "",
  tipo,
  status: "pendente",
  valor: "",
  vencimento: new Date().toISOString().slice(0, 10),
  metodo: NENHUM,
  categoria_id: NENHUM,
  cliente_id: NENHUM,
  fornecedor_id: NENHUM,
  documento: "",
  observacoes: "",
});

function LancamentosTab() {
  const qc = useQueryClient();
  const { config } = useEmpresa();
  const moeda = config?.moeda ?? "MZN";

  const { data: lancamentos = [], isLoading } = useLancamentos();
  const { data: categorias = [] } = useCategorias();

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | Tipo>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Status>("todos");
  const [form, setForm] = useState<FormState | null>(null);
  const [apagar, setApagar] = useState<Lancamento | null>(null);

  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "—";
  const nomeParte = (l: Lancamento) =>
    clientes.find((c) => c.id === l.cliente_id)?.nome ??
    fornecedores.find((f) => f.id === l.fornecedor_id)?.nome ??
    "—";

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (!q) return true;
      return (
        l.descricao.toLowerCase().includes(q) ||
        (l.documento ?? "").toLowerCase().includes(q) ||
        nomeCategoria(l.categoria_id).toLowerCase().includes(q)
      );
    });
  }, [lancamentos, busca, filtroTipo, filtroStatus, categorias]);

  const hoje = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const pend = lancamentos.filter((l) => l.status === "pendente");
    const pagos = lancamentos.filter((l) => l.status === "pago");
    const soma = (arr: Lancamento[], t: Tipo) =>
      arr.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);
    return {
      receber: soma(pend, "receita"),
      pagar: soma(pend, "despesa"),
      saldo: soma(pagos, "receita") - soma(pagos, "despesa"),
      vencidas: pend.filter((l) => l.vencimento < hoje).length,
    };
  }, [lancamentos]);

  const guardar = useMutation({
    mutationFn: async (f: FormState) => {
      const parsed = lancamentoSchema.parse({
        descricao: f.descricao,
        tipo: f.tipo,
        valor: Number(f.valor),
        vencimento: f.vencimento,
        documento: f.documento.trim() || null,
        observacoes: f.observacoes.trim() || null,
      });
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        ...parsed,
        status: f.status,
        metodo: f.metodo === NENHUM ? null : (f.metodo as Metodo),
        categoria_id: f.categoria_id === NENHUM ? null : f.categoria_id,
        cliente_id: f.cliente_id === NENHUM ? null : f.cliente_id,
        fornecedor_id: f.fornecedor_id === NENHUM ? null : f.fornecedor_id,
        pago_em: f.status === "pago" ? new Date().toISOString() : null,
        user_id: userData.user?.id ?? null,
      };
      if (f.id) {
        const { error } = await supabase.from("financeiro_lancamentos").update(payload).eq("id", f.id);
        if (error) throw error;
        return { id: f.id, novo: false as const, payload };
      }
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, novo: true as const, payload };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      setForm(null);
      toast.success(r.novo ? "Lançamento criado" : "Lançamento actualizado");
      void registarAuditoria({
        modulo: "Financeiro",
        acao: r.novo ? "criar" : "actualizar",
        entidade: "lancamento",
        entidade_id: r.id,
        descricao: `${r.payload.tipo === "receita" ? "Receita" : "Despesa"}: ${r.payload.descricao} (${r.payload.valor})`,
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error(msg ?? "Não foi possível guardar");
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ l, status }: { l: Lancamento; status: Status }) => {
      const { error } = await supabase
        .from("financeiro_lancamentos")
        .update({ status, pago_em: status === "pago" ? new Date().toISOString() : null })
        .eq("id", l.id);
      if (error) throw error;
      return { l, status };
    },
    onSuccess: ({ l, status }) => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      toast.success(status === "pago" ? "Lançamento liquidado" : "Estado actualizado");
      void registarAuditoria({
        modulo: "Financeiro",
        acao: status === "pago" ? "liquidar" : status,
        entidade: "lancamento",
        entidade_id: l.id,
        descricao: `${l.descricao} → ${STATUS_META[status].label}`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (l: Lancamento) => {
      const { error } = await supabase.from("financeiro_lancamentos").delete().eq("id", l.id);
      if (error) throw error;
      return l;
    },
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      setApagar(null);
      toast.success("Lançamento eliminado");
      void registarAuditoria({
        modulo: "Financeiro",
        acao: "apagar",
        entidade: "lancamento",
        entidade_id: l.id,
        descricao: l.descricao,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const colunas = ["Vencimento", "Descrição", "Tipo", "Categoria", "Entidade", "Estado", "Valor"];
  const linhas = () =>
    lista.map((l) => [
      dataCurta(l.vencimento),
      l.descricao,
      l.tipo === "receita" ? "Receita" : "Despesa",
      nomeCategoria(l.categoria_id),
      nomeParte(l),
      STATUS_META[l.status].label,
      fmt(Number(l.valor), moeda),
    ]);

  const exportarPdf = async (imprimir = false) => {
    const empresa = await getEmpresaDoc();
    const doc = criarRelatorioPdf(empresa, {
      titulo: "Movimentos financeiros",
      subtitulo: `${lista.length} lançamento(s)`,
      colunas,
      linhas: linhas(),
      resumo: [
        { label: "A receber (pendente)", valor: fmt(stats.receber, moeda) },
        { label: "A pagar (pendente)", valor: fmt(stats.pagar, moeda) },
        { label: "Saldo liquidado", valor: fmt(stats.saldo, moeda) },
      ],
      orientacao: "landscape",
    });
    if (imprimir) imprimirPdf(doc);
    else doc.save(nomeFicheiro("financeiro"));
    void registarAuditoria({
      modulo: "Financeiro",
      acao: "exportar",
      descricao: `${imprimir ? "Impressão" : "PDF"} de ${lista.length} lançamento(s)`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titulo="Contas a receber" valor={fmt(stats.receber, moeda)} icon={TrendingUp} tone="text-emerald-600" />
        <StatCard titulo="Contas a pagar" valor={fmt(stats.pagar, moeda)} icon={TrendingDown} tone="text-destructive" />
        <StatCard titulo="Saldo liquidado" valor={fmt(stats.saldo, moeda)} icon={Wallet} tone="text-primary" />
        <StatCard titulo="Vencidas" valor={String(stats.vencidas)} icon={AlertTriangle} tone="text-amber-600" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por descrição, documento ou categoria"
                className="pl-9"
              />
            </div>
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
              <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
              <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Liquidados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="icon" title="Exportar CSV"
                onClick={() => exportarCsv("financeiro", colunas, linhas())}>
                <SheetIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="Exportar PDF" onClick={() => void exportarPdf(false)}>
                <FileDown className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="Imprimir" onClick={() => void exportarPdf(true)}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button onClick={() => setForm(formVazio("despesa"))}>
                <Plus className="mr-2 h-4 w-4" /> Novo lançamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-32 text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
                )}
                {!isLoading && lista.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sem lançamentos para os filtros escolhidos.</TableCell></TableRow>
                )}
                {lista.map((l) => {
                  const vencida = l.status === "pendente" && l.vencimento < hoje;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className={vencida ? "font-medium text-destructive" : ""}>
                        {dataCurta(l.vencimento)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.descricao}</div>
                        {l.documento && <div className="text-xs text-muted-foreground">Doc.: {l.documento}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{nomeCategoria(l.categoria_id)}</TableCell>
                      <TableCell className="text-muted-foreground">{nomeParte(l)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_META[l.status].className}>
                          {STATUS_META[l.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${l.tipo === "receita" ? "text-emerald-600" : "text-destructive"}`}>
                        {l.tipo === "receita" ? "+" : "−"} {fmt(Number(l.valor), moeda)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {l.status === "pendente" && (
                            <>
                              <Button variant="ghost" size="icon" title="Marcar como liquidado"
                                onClick={() => mudarStatus.mutate({ l, status: "pago" })}>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Cancelar"
                                onClick={() => mudarStatus.mutate({ l, status: "cancelado" })}>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost" size="icon" title="Editar"
                            onClick={() =>
                              setForm({
                                id: l.id,
                                descricao: l.descricao,
                                tipo: l.tipo,
                                status: l.status,
                                valor: String(l.valor),
                                vencimento: l.vencimento,
                                metodo: l.metodo ?? NENHUM,
                                categoria_id: l.categoria_id ?? NENHUM,
                                cliente_id: l.cliente_id ?? NENHUM,
                                fornecedor_id: l.fornecedor_id ?? NENHUM,
                                documento: l.documento ?? "",
                                observacoes: l.observacoes ?? "",
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setApagar(l)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>Receitas, despesas e contas a pagar ou a receber.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo, categoria_id: NENHUM })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Liquidado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex.: Renda do espaço — Setembro" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input type="number" min="0" step="0.01" value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Sem categoria</SelectItem>
                      {categorias.filter((c) => c.tipo === form.tipo && c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select value={form.metodo} onValueChange={(v) => setForm({ ...form, metodo: v })}>
                    <SelectTrigger><SelectValue placeholder="Não definida" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não definida</SelectItem>
                      {METODOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{form.tipo === "receita" ? "Cliente (opcional)" : "Fornecedor (opcional)"}</Label>
                {form.tipo === "receita" ? (
                  <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v, fornecedor_id: NENHUM })}>
                    <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Sem cliente</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v, cliente_id: NENHUM })}>
                    <SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Sem fornecedor</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Documento (opcional)</Label>
                <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  placeholder="Factura, recibo, contrato…" />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={guardar.isPending} onClick={() => form && guardar.mutate(form)}>
              {guardar.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={(o) => !o && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              “{apagar?.descricao}” será removido definitivamente do financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apagar && remover.mutate(apagar)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------- Fluxo -------------------------------- */

function FluxoTab() {
  const { config } = useEmpresa();
  const moeda = config?.moeda ?? "MZN";
  const { data: lancamentos = [] } = useLancamentos();
  const { data: categorias = [] } = useCategorias();

  const { data: vendas = [] } = useQuery({
    queryKey: ["fin-vendas-pagas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("total, paga_em")
        .eq("status", "paga")
        .not("paga_em", "is", null);
      if (error) throw error;
      return data as { total: number; paga_em: string }[];
    },
  });

  const meses = useMemo(() => {
    const mapa = new Map<string, { receitas: number; despesas: number }>();
    const bucket = (k: string) => {
      if (!mapa.has(k)) mapa.set(k, { receitas: 0, despesas: 0 });
      return mapa.get(k)!;
    };
    for (const l of lancamentos) {
      if (l.status !== "pago") continue;
      const k = (l.pago_em ?? l.vencimento).slice(0, 7);
      const b = bucket(k);
      if (l.tipo === "receita") b.receitas += Number(l.valor);
      else b.despesas += Number(l.valor);
    }
    for (const v of vendas) {
      const b = bucket(v.paga_em.slice(0, 7));
      b.receitas += Number(v.total);
    }
    return [...mapa.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12)
      .map(([mes, v]) => ({ mes, ...v, saldo: v.receitas - v.despesas }));
  }, [lancamentos, vendas]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.status !== "pago" || l.tipo !== "despesa") continue;
      const nome = categorias.find((c) => c.id === l.categoria_id)?.nome ?? "Sem categoria";
      mapa.set(nome, (mapa.get(nome) ?? 0) + Number(l.valor));
    }
    const total = [...mapa.values()].reduce((s, v) => s + v, 0);
    return [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor]) => ({ nome, valor, pct: total ? (valor / total) * 100 : 0 }));
  }, [lancamentos, categorias]);

  const totalReceitas = meses.reduce((s, m) => s + m.receitas, 0);
  const totalDespesas = meses.reduce((s, m) => s + m.despesas, 0);

  const nomeMes = (k: string) => {
    try {
      return format(parseISO(`${k}-01`), "MMMM 'de' yyyy", { locale: pt });
    } catch {
      return k;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard titulo="Receitas (12 meses)" valor={fmt(totalReceitas, moeda)} icon={TrendingUp} tone="text-emerald-600" />
        <StatCard titulo="Despesas (12 meses)" valor={fmt(totalDespesas, moeda)} icon={TrendingDown} tone="text-destructive" />
        <StatCard titulo="Lucro do período" valor={fmt(totalReceitas - totalDespesas, moeda)} icon={Wallet} tone="text-primary" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Ainda não há movimentos liquidados.</TableCell></TableRow>
                )}
                {meses.map((m) => (
                  <TableRow key={m.mes}>
                    <TableCell className="capitalize font-medium">{nomeMes(m.mes)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(m.receitas, moeda)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(m.despesas, moeda)}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {fmt(m.saldo, moeda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-base font-semibold">Despesas por categoria</h2>
          {porCategoria.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem despesas liquidadas até ao momento.</p>
          )}
          {porCategoria.map((c) => (
            <div key={c.nome} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{c.nome}</span>
                <span className="font-medium">{fmt(c.valor, moeda)} · {c.pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, c.pct)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Categorias ----------------------------- */

function CategoriasTab() {
  const qc = useQueryClient();
  const { data: categorias = [], isLoading } = useCategorias();
  const [form, setForm] = useState<{ id: string | null; nome: string; tipo: Tipo } | null>(null);
  const [apagar, setApagar] = useState<Categoria | null>(null);

  const guardar = useMutation({
    mutationFn: async (f: { id: string | null; nome: string; tipo: Tipo }) => {
      const parsed = categoriaSchema.parse({ nome: f.nome, tipo: f.tipo });
      if (f.id) {
        const { error } = await supabase.from("financeiro_categorias").update(parsed).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financeiro_categorias").insert(parsed);
        if (error) throw error;
      }
      return f;
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      setForm(null);
      toast.success(f.id ? "Categoria actualizada" : "Categoria criada");
      void registarAuditoria({
        modulo: "Financeiro",
        acao: f.id ? "actualizar" : "criar",
        entidade: "categoria financeira",
        descricao: f.nome,
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error(msg ?? "Não foi possível guardar");
    },
  });

  const remover = useMutation({
    mutationFn: async (c: Categoria) => {
      const { count } = await supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", c.id);
      if (count && count > 0) throw new Error("Categoria com lançamentos associados — desactive-a em vez de apagar.");
      const { error } = await supabase.from("financeiro_categorias").delete().eq("id", c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      setApagar(null);
      toast.success("Categoria eliminada");
      void registarAuditoria({ modulo: "Financeiro", acao: "apagar", entidade: "categoria financeira", descricao: c.nome });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async (c: Categoria) => {
      const { error } = await supabase
        .from("financeiro_categorias")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-categorias"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null, nome: "", tipo: "despesa" })}>
          <Plus className="mr-2 h-4 w-4" /> Nova categoria
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-28 text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              )}
              {categorias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.tipo === "receita"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {c.tipo === "receita" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => alternar.mutate(c)}>
                      {c.is_active ? "Activa" : "Inactiva"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar"
                        onClick={() => setForm({ id: c.id, nome: c.nome, tipo: c.tipo })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setApagar(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Organize receitas e despesas por categoria.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={guardar.isPending} onClick={() => form && guardar.mutate(form)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={(o) => !o && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
            <AlertDialogDescription>“{apagar?.nome}” deixará de estar disponível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apagar && remover.mutate(apagar)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------ auxiliares ----------------------------- */

function StatCard({
  titulo, valor, icon: Icon, tone,
}: { titulo: string; valor: string; icon: React.ElementType; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className={`mt-1 text-xl font-bold ${tone}`}>{valor}</p>
        </div>
        <Icon className={`h-8 w-8 opacity-20 ${tone}`} />
      </CardContent>
    </Card>
  );
}
