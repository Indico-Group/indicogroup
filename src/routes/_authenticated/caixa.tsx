import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Lock, Unlock, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp,
  TrendingDown, AlertCircle, Printer, History,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Aldeia Mesa" },
      { name: "description", content: "Abertura e fecho de caixa, sangrias, reforços e conferência com as vendas do dia." },
    ],
  }),
  component: CaixaPage,
});

type SessaoStatus = "aberta" | "fechada";
type MovTipo = "entrada" | "saida" | "sangria" | "reforco";

type Sessao = {
  id: string;
  user_id: string;
  valor_abertura: number;
  valor_fechamento: number | null;
  valor_esperado: number | null;
  diferenca: number | null;
  status: SessaoStatus;
  observacoes_abertura: string | null;
  observacoes_fechamento: string | null;
  aberta_em: string;
  fechada_em: string | null;
};

type Movimento = {
  id: string;
  sessao_id: string;
  user_id: string | null;
  tipo: MovTipo;
  valor: number;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
};

const TIPO_META: Record<MovTipo, { label: string; color: string; sign: 1 | -1 }> = {
  entrada: { label: "Entrada", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", sign: 1 },
  reforco: { label: "Reforço", color: "text-teal-600 bg-teal-500/10 border-teal-500/20", sign: 1 },
  saida: { label: "Saída", color: "text-orange-600 bg-orange-500/10 border-orange-500/20", sign: -1 },
  sangria: { label: "Sangria", color: "text-red-600 bg-red-500/10 border-red-500/20", sign: -1 },
};

const abrirSchema = z.object({
  valor_abertura: z.coerce.number().min(0, "Valor inválido"),
  observacoes: z.string().max(500).optional(),
});

const movSchema = z.object({
  tipo: z.enum(["entrada", "saida", "sangria", "reforco"]),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  motivo: z.string().trim().min(1, "Informe o motivo").max(200),
  referencia: z.string().max(100).optional(),
});

const fecharSchema = z.object({
  valor_fechamento: z.coerce.number().min(0, "Valor inválido"),
  observacoes: z.string().max(500).optional(),
});

const fmt = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" }).format(v || 0);

function CaixaPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("atual");
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);

  const { data: sessaoAtual } = useQuery({
    queryKey: ["caixa", "atual"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("caixa_sessoes").select("*").eq("status", "aberta")
        .order("aberta_em", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as Sessao | null;
    },
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ["caixa", "movimentos", sessaoAtual?.id],
    enabled: !!sessaoAtual?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("caixa_movimentos").select("*").eq("sessao_id", sessaoAtual!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movimento[];
    },
  });

  const { data: vendasSessao = [] } = useQuery({
    queryKey: ["caixa", "vendas", sessaoAtual?.id],
    enabled: !!sessaoAtual?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas").select("id,total,metodo_pagamento,status,paga_em,numero")
        .eq("status", "paga").gte("paga_em", sessaoAtual!.aberta_em);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["caixa", "historico"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("caixa_sessoes").select("*")
        .order("aberta_em", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Sessao[];
    },
  });

  const totais = useMemo(() => {
    const vendasDinheiro = vendasSessao
      .filter((v: any) => v.metodo_pagamento === "dinheiro")
      .reduce((s: number, v: any) => s + Number(v.total ?? 0), 0);
    const vendasTotal = vendasSessao.reduce((s: number, v: any) => s + Number(v.total ?? 0), 0);
    const entradas = movimentos.filter(m => TIPO_META[m.tipo].sign > 0).reduce((s, m) => s + Number(m.valor), 0);
    const saidas = movimentos.filter(m => TIPO_META[m.tipo].sign < 0).reduce((s, m) => s + Number(m.valor), 0);
    const esperado = Number(sessaoAtual?.valor_abertura ?? 0) + vendasDinheiro + entradas - saidas;
    return { vendasDinheiro, vendasTotal, entradas, saidas, esperado, qtdVendas: vendasSessao.length };
  }, [movimentos, vendasSessao, sessaoAtual]);

  const abrirMut = useMutation({
    mutationFn: async (values: z.infer<typeof abrirSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).from("caixa_sessoes").insert({
        user_id: uid,
        valor_abertura: values.valor_abertura,
        observacoes_abertura: values.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      setOpenAbrir(false);
      qc.invalidateQueries({ queryKey: ["caixa"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao abrir caixa"),
  });

  const movMut = useMutation({
    mutationFn: async (values: z.infer<typeof movSchema>) => {
      if (!sessaoAtual) throw new Error("Nenhum caixa aberto");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("caixa_movimentos").insert({
        sessao_id: sessaoAtual.id,
        user_id: userData.user?.id ?? null,
        ...values,
        referencia: values.referencia || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimento registado");
      setOpenMov(false);
      qc.invalidateQueries({ queryKey: ["caixa", "movimentos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registar movimento"),
  });

  const fecharMut = useMutation({
    mutationFn: async (values: z.infer<typeof fecharSchema>) => {
      if (!sessaoAtual) throw new Error("Nenhum caixa aberto");
      const diferenca = values.valor_fechamento - totais.esperado;
      const { error } = await (supabase as any).from("caixa_sessoes").update({
        status: "fechada",
        valor_fechamento: values.valor_fechamento,
        valor_esperado: totais.esperado,
        diferenca,
        observacoes_fechamento: values.observacoes || null,
        fechada_em: new Date().toISOString(),
      }).eq("id", sessaoAtual.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa fechado");
      setOpenFechar(false);
      qc.invalidateQueries({ queryKey: ["caixa"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao fechar caixa"),
  });

  return (
    <div>
      <PageHeader
        title="Caixa"
        description="Abertura e fecho de turno, entradas, saídas, sangrias e conferência de vendas"
        actions={
          !sessaoAtual ? (
            <Button onClick={() => setOpenAbrir(true)}>
              <Unlock className="mr-2 h-4 w-4" /> Abrir caixa
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpenMov(true)}>
                <Plus className="mr-2 h-4 w-4" /> Movimento
              </Button>
              <Button variant="destructive" onClick={() => setOpenFechar(true)}>
                <Lock className="mr-2 h-4 w-4" /> Fechar caixa
              </Button>
            </div>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="atual"><Wallet className="mr-2 h-4 w-4" />Caixa Atual</TabsTrigger>
          <TabsTrigger value="historico"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="atual" className="mt-4 space-y-4">
          {!sessaoAtual ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">Nenhum caixa aberto</h3>
                  <p className="text-sm text-muted-foreground">Abra o caixa para começar o turno.</p>
                </div>
                <Button onClick={() => setOpenAbrir(true)}>
                  <Unlock className="mr-2 h-4 w-4" /> Abrir caixa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Abertura" value={fmt(Number(sessaoAtual.valor_abertura))} icon={<Wallet className="h-4 w-4" />} />
                <StatCard label={`Vendas do turno (${totais.qtdVendas})`} value={fmt(totais.vendasTotal)} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} />
                <StatCard label="Vendas em dinheiro" value={fmt(totais.vendasDinheiro)} icon={<ArrowUpCircle className="h-4 w-4 text-emerald-600" />} />
                <StatCard label="Entradas / Saídas" value={`${fmt(totais.entradas)} / ${fmt(totais.saidas)}`} icon={<TrendingDown className="h-4 w-4 text-orange-600" />} />
                <StatCard label="Esperado em caixa" value={fmt(totais.esperado)} highlight icon={<Wallet className="h-4 w-4 text-primary" />} />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Movimentos do turno</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Aberto {formatDistanceToNow(new Date(sessaoAtual.aberta_em), { addSuffix: true, locale: pt })}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">Aberto</Badge>
                </CardHeader>
                <CardContent>
                  {movimentos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Sem movimentos registados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentos.map((m) => {
                          const meta = TIPO_META[m.tipo];
                          return (
                            <TableRow key={m.id}>
                              <TableCell><Badge variant="outline" className={meta.color}>{meta.label}</Badge></TableCell>
                              <TableCell>{m.motivo}</TableCell>
                              <TableCell className="text-muted-foreground">{m.referencia ?? "—"}</TableCell>
                              <TableCell className={`text-right font-medium ${meta.sign > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {meta.sign > 0 ? "+" : "-"}{fmt(Number(m.valor))}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(m.created_at), "dd/MM HH:mm", { locale: pt })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Últimos turnos</CardTitle></CardHeader>
            <CardContent>
              {historico.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aberto</TableHead>
                      <TableHead>Fechado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Abertura</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Fechamento</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{format(new Date(s.aberta_em), "dd/MM/yy HH:mm", { locale: pt })}</TableCell>
                        <TableCell>{s.fechada_em ? format(new Date(s.fechada_em), "dd/MM/yy HH:mm", { locale: pt }) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={s.status === "aberta" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-muted"}>
                            {s.status === "aberta" ? "Aberto" : "Fechado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmt(Number(s.valor_abertura))}</TableCell>
                        <TableCell className="text-right">{s.valor_esperado != null ? fmt(Number(s.valor_esperado)) : "—"}</TableCell>
                        <TableCell className="text-right">{s.valor_fechamento != null ? fmt(Number(s.valor_fechamento)) : "—"}</TableCell>
                        <TableCell className={`text-right font-medium ${s.diferenca == null ? "" : Number(s.diferenca) === 0 ? "text-emerald-600" : Number(s.diferenca) > 0 ? "text-blue-600" : "text-red-600"}`}>
                          {s.diferenca != null ? fmt(Number(s.diferenca)) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AbrirDialog open={openAbrir} onOpenChange={setOpenAbrir} onSubmit={(v) => abrirMut.mutate(v)} loading={abrirMut.isPending} />
      <MovDialog open={openMov} onOpenChange={setOpenMov} onSubmit={(v) => movMut.mutate(v)} loading={movMut.isPending} />
      <FecharDialog
        open={openFechar} onOpenChange={setOpenFechar}
        onSubmit={(v) => fecharMut.mutate(v)} loading={fecharMut.isPending}
        esperado={totais.esperado} sessao={sessaoAtual ?? null}
      />
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>{icon}
        </div>
        <div className="mt-2 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function AbrirDialog({ open, onOpenChange, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (v: z.infer<typeof abrirSchema>) => void; loading: boolean;
}) {
  const [valor, setValor] = useState("0");
  const [obs, setObs] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>Informe o valor inicial (fundo de troco).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor de abertura (MZN)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading}
            onClick={() => {
              const parsed = abrirSchema.safeParse({ valor_abertura: valor, observacoes: obs });
              if (!parsed.success) return toast.error(parsed.error.issues[0].message);
              onSubmit(parsed.data);
            }}
          >Abrir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovDialog({ open, onOpenChange, onSubmit, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (v: z.infer<typeof movSchema>) => void; loading: boolean;
}) {
  const [tipo, setTipo] = useState<MovTipo>("entrada");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ref, setRef] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registar movimento</DialogTitle>
          <DialogDescription>Entradas, saídas, sangrias e reforços do caixa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as MovTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="reforco">Reforço</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="sangria">Sangria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (MZN)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: pagamento fornecedor" />
          </div>
          <div>
            <Label>Referência</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading}
            onClick={() => {
              const parsed = movSchema.safeParse({ tipo, valor, motivo, referencia: ref });
              if (!parsed.success) return toast.error(parsed.error.issues[0].message);
              onSubmit(parsed.data);
              setValor(""); setMotivo(""); setRef("");
            }}
          >Registar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FecharDialog({ open, onOpenChange, onSubmit, loading, esperado, sessao }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (v: z.infer<typeof fecharSchema>) => void; loading: boolean;
  esperado: number; sessao: Sessao | null;
}) {
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const contado = Number(valor || 0);
  const diferenca = contado - esperado;

  const imprimir = () => {
    if (!sessao) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Fecho de Caixa</title>
      <style>body{font-family:monospace;padding:20px;font-size:12px}h2{text-align:center}hr{border:0;border-top:1px dashed #999}.row{display:flex;justify-content:space-between;margin:4px 0}</style>
      </head><body>
      <h2>ALDEIA MESA</h2>
      <h3 style="text-align:center">Fecho de Caixa</h3>
      <hr/>
      <div class="row"><span>Aberto:</span><span>${format(new Date(sessao.aberta_em), "dd/MM/yy HH:mm")}</span></div>
      <div class="row"><span>Fechado:</span><span>${format(new Date(), "dd/MM/yy HH:mm")}</span></div>
      <hr/>
      <div class="row"><span>Valor abertura:</span><span>${fmt(Number(sessao.valor_abertura))}</span></div>
      <div class="row"><span>Esperado:</span><span>${fmt(esperado)}</span></div>
      <div class="row"><span>Contado:</span><span>${fmt(contado)}</span></div>
      <div class="row"><strong>Diferença:</strong><strong>${fmt(diferenca)}</strong></div>
      <hr/>
      <p style="text-align:center">Aldeia Mesa • Desenvolvido por Dausse de Clune do Rosário</p>
      </body></html>
    `);
    w.document.close(); w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>Confira o valor em caixa contra o esperado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Esperado em caixa</span><strong>{fmt(esperado)}</strong></div>
          </div>
          <div>
            <Label>Valor contado (MZN)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
          </div>
          {valor && (
            <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              diferenca === 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                : diferenca > 0 ? "border-blue-500/40 bg-blue-500/10 text-blue-700"
                : "border-red-500/40 bg-red-500/10 text-red-700"
            }`}>
              <AlertCircle className="h-4 w-4" />
              <span>Diferença: <strong>{fmt(diferenca)}</strong> {diferenca === 0 ? "(exato)" : diferenca > 0 ? "(sobra)" : "(falta)"}</span>
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={imprimir} disabled={!valor}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive" disabled={loading}
            onClick={() => {
              const parsed = fecharSchema.safeParse({ valor_fechamento: valor, observacoes: obs });
              if (!parsed.success) return toast.error(parsed.error.issues[0].message);
              onSubmit(parsed.data);
            }}
          >Fechar caixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
