import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Search, UserCog, CalendarCheck, Wallet,
  CheckCircle2, XCircle, Clock, Palmtree, Coffee, FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/use-empresa";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({
    meta: [
      { title: "Funcionários — Aldeia Mesa" },
      {
        name: "description",
        content:
          "Gestão de funcionários do Aldeia Mesa: cadastro, marcação de presenças diárias e cálculo do salário mensal.",
      },
      { property: "og:title", content: "Funcionários — Aldeia Mesa" },
      {
        property: "og:description",
        content: "Cadastro de pessoal, presenças diárias e folha salarial mensal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FuncionariosPage,
});

/* ---------------------------------------------------------------- tipos */

type Funcionario = {
  id: string;
  codigo: string | null;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  morada: string | null;
  turno: string | null;
  salario_base: number;
  subsidios: number;
  desconto_percent: number;
  valor_hora_extra: number;
  admitido_em: string | null;
  saiu_em: string | null;
  notas: string | null;
  is_active: boolean;
};

type Estado = "presente" | "falta" | "falta_justificada" | "ferias" | "folga" | "meio_periodo";

type Presenca = {
  id: string;
  funcionario_id: string;
  data: string;
  estado: Estado;
  horas: number;
  horas_extra: number;
  observacoes: string | null;
};

const ESTADOS: {
  value: Estado;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  /** fracção do dia efectivamente paga */
  factor: number;
}[] = [
  { value: "presente", label: "Presente", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", factor: 1 },
  { value: "meio_periodo", label: "Meio período", icon: Clock, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400", factor: 0.5 },
  { value: "falta_justificada", label: "Falta justificada", icon: FileWarning, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400", factor: 1 },
  { value: "ferias", label: "Férias", icon: Palmtree, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400", factor: 1 },
  { value: "folga", label: "Folga", icon: Coffee, className: "bg-muted text-muted-foreground", factor: 1 },
  { value: "falta", label: "Falta", icon: XCircle, className: "bg-destructive/15 text-destructive", factor: 0 },
];

const estadoInfo = (e: Estado) => ESTADOS.find((s) => s.value === e) ?? ESTADOS[0];

/* ------------------------------------------------------------ utilitários */

const pad = (n: number) => String(n).padStart(2, "0");
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const mesAtual = () => hoje().slice(0, 7);

function diasDoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Dias já decorridos do mês (limita ao dia de hoje quando é o mês corrente). */
function diasDecorridos(mes: string) {
  const total = diasDoMes(mes);
  if (mes === mesAtual()) return Number(hoje().slice(8, 10));
  return total;
}

export type Calculo = {
  diasUteis: number;
  diasPagos: number;
  diasSemRegisto: number;
  faltas: number;
  presencas: number;
  horasExtra: number;
  valorDia: number;
  bruto: number;
  extras: number;
  descontoFaltas: number;
  descontoPercent: number;
  liquido: number;
};

/** Cálculo do salário mensal a partir das presenças marcadas. */
export function calcularSalario(f: Funcionario, presencas: Presenca[], mes: string): Calculo {
  const diasUteis = diasDoMes(mes);
  const valorDia = Number(f.salario_base || 0) / diasUteis;
  const limiteDia = diasDecorridos(mes);
  const primeiroDiaEmprego = f.admitido_em?.startsWith(mes) ? Number(f.admitido_em.slice(8, 10)) : 1;
  const ultimoDiaEmprego = f.saiu_em?.startsWith(mes)
    ? Math.min(limiteDia, Number(f.saiu_em.slice(8, 10)))
    : limiteDia;
  const diasEsperados = Math.max(0, ultimoDiaEmprego - primeiroDiaEmprego + 1);
  const presencasConsideradas = presencas.filter(
    (p) => p.data >= `${mes}-${pad(primeiroDiaEmprego)}` && p.data <= `${mes}-${pad(ultimoDiaEmprego)}`,
  );

  let diasPagos = 0;
  let diasNaoPagosRegistados = 0;
  let faltas = 0;
  let presentes = 0;
  let horasExtra = 0;

  for (const p of presencasConsideradas) {
    const info = estadoInfo(p.estado);
    diasPagos += info.factor;
    diasNaoPagosRegistados += 1 - info.factor;
    if (info.factor === 0) faltas += 1;
    if (p.estado === "presente" || p.estado === "meio_periodo") presentes += 1;
    horasExtra += Number(p.horas_extra || 0);
  }

  // Ausência de registo é pendência, nunca presença confirmada.
  const diasSemRegisto = Math.max(0, diasEsperados - presencasConsideradas.length);
  // Só faltas efectivamente registadas podem gerar desconto; dias pendentes não geram desconto automático.
  const descontoFaltas = Math.max(0, diasNaoPagosRegistados * valorDia);
  const extras = horasExtra * Number(f.valor_hora_extra || 0);
  const bruto = Number(f.salario_base || 0) + Number(f.subsidios || 0);
  const base = bruto - descontoFaltas + extras;
  const descontoPercent = (base * Number(f.desconto_percent || 0)) / 100;

  return {
    diasUteis,
    diasPagos,
    diasSemRegisto,
    faltas,
    presencas: presentes,
    horasExtra,
    valorDia,
    bruto,
    extras,
    descontoFaltas,
    descontoPercent,
    liquido: Math.max(0, base - descontoPercent),
  };
}

/* --------------------------------------------------------------- schema */

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  codigo: z.string().trim().max(30).nullable(),
  cargo: z.string().trim().max(80).nullable(),
  telefone: z.string().trim().max(40).nullable(),
  email: z.union([z.string().trim().email("Email inválido"), z.literal("")]).nullable(),
  documento: z.string().trim().max(60).nullable(),
  morada: z.string().trim().max(200).nullable(),
  turno: z.string().trim().max(40).nullable(),
  salario_base: z.number().min(0, "Salário inválido"),
  subsidios: z.number().min(0),
  desconto_percent: z.number().min(0).max(100),
  valor_hora_extra: z.number().min(0),
  admitido_em: z.string().nullable(),
  saiu_em: z.string().nullable(),
  notas: z.string().trim().max(500).nullable(),
  is_active: z.boolean(),
});

type FormState = z.infer<typeof schema>;

const emptyForm: FormState = {
  nome: "", codigo: "", cargo: "", telefone: "", email: "", documento: "",
  morada: "", turno: "", salario_base: 0, subsidios: 0, desconto_percent: 0,
  valor_hora_extra: 0, admitido_em: null, saiu_em: null, notas: "", is_active: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- página */

function FuncionariosPage() {
  const qc = useQueryClient();
  const { config } = useEmpresa();
  const { canDo } = usePermissions();
  const podeGerir = canDo("gerirPessoas");
  const moeda = config?.moeda ?? "MZN";

  const fmt = useMemo(
    () => (v: number) =>
      new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number.isFinite(v) ? v : 0,
      ) + ` ${moeda}`,
    [moeda],
  );

  const [search, setSearch] = useState("");
  const [mes, setMes] = useState(mesAtual());
  const [dia, setDia] = useState(hoje());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Funcionario | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as unknown as Funcionario[];
    },
  });

  const inicioMes = `${mes}-01`;
  const fimMes = `${mes}-${pad(diasDoMes(mes))}`;

  const { data: presencasMes = [] } = useQuery({
    queryKey: ["presencas", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presencas")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data as unknown as Presenca[];
    },
  });

  const { data: presencasDia = [] } = useQuery({
    queryKey: ["presencas-dia", dia],
    queryFn: async () => {
      const { data, error } = await supabase.from("presencas").select("*").eq("data", dia);
      if (error) throw error;
      return data as unknown as Presenca[];
    },
  });

  const presencaDoDia = useMemo(() => {
    const m = new Map<string, Presenca>();
    presencasDia.forEach((p) => m.set(p.funcionario_id, p));
    return m;
  }, [presencasDia]);

  const presencasPorFuncionario = useMemo(() => {
    const m = new Map<string, Presenca[]>();
    presencasMes.forEach((p) => {
      const arr = m.get(p.funcionario_id) ?? [];
      arr.push(p);
      m.set(p.funcionario_id, arr);
    });
    return m;
  }, [presencasMes]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return funcionarios;
    return funcionarios.filter((f) =>
      [f.nome, f.cargo, f.codigo, f.telefone, f.turno]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [funcionarios, search]);

  const activos = funcionarios.filter((f) => f.is_active);

  const folha = useMemo(
    () =>
      activos.map((f) => ({
        f,
        calc: calcularSalario(f, presencasPorFuncionario.get(f.id) ?? [], mes),
      })),
    [activos, presencasPorFuncionario, mes],
  );

  const totalFolha = folha.reduce((s, r) => s + r.calc.liquido, 0);
  const totalFaltas = folha.reduce((s, r) => s + r.calc.faltas, 0);

  /* ------------------------------------------------------------ mutações */

  const saveFuncionario = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      const { id, ...rest } = payload;
      const row = {
        ...rest,
        codigo: rest.codigo || null,
        cargo: rest.cargo || null,
        telefone: rest.telefone || null,
        email: rest.email || null,
        documento: rest.documento || null,
        morada: rest.morada || null,
        turno: rest.turno || null,
        notas: rest.notas || null,
        admitido_em: rest.admitido_em || null,
        saiu_em: rest.saiu_em || null,
      };
      if (id) {
        const { error } = await supabase.from("funcionarios").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("funcionarios").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      setOpen(false);
      toast.success(editing ? "Funcionário actualizado" : "Funcionário registado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerFuncionario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["presencas", mes] });
      setConfirmDelete(null);
      toast.success("Funcionário removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarPresenca = useMutation({
    mutationFn: async (args: {
      funcionario_id: string;
      estado: Estado;
      horas_extra?: number;
      observacoes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const existente = presencaDoDia.get(args.funcionario_id);
      const row = {
        funcionario_id: args.funcionario_id,
        data: dia,
        estado: args.estado,
        horas: args.estado === "meio_periodo" ? 4 : args.estado === "falta" ? 0 : 8,
        horas_extra: args.horas_extra ?? existente?.horas_extra ?? 0,
        observacoes: args.observacoes ?? existente?.observacoes ?? null,
        user_id: userData.user?.id ?? null,
      };
      const { error } = await supabase
        .from("presencas")
        .upsert(row, { onConflict: "funcionario_id,data" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presencas-dia", dia] });
      qc.invalidateQueries({ queryKey: ["presencas", mes] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarTodos = async (estado: Estado) => {
    for (const f of activos) {
      await marcarPresenca.mutateAsync({ funcionario_id: f.id, estado });
    }
    toast.success(`Todos marcados como ${estadoInfo(estado).label.toLowerCase()}`);
  };

  /* ---------------------------------------------------------------- form */

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (f: Funcionario) => {
    setEditing(f);
    setForm({
      nome: f.nome,
      codigo: f.codigo ?? "",
      cargo: f.cargo ?? "",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      documento: f.documento ?? "",
      morada: f.morada ?? "",
      turno: f.turno ?? "",
      salario_base: Number(f.salario_base),
      subsidios: Number(f.subsidios),
      desconto_percent: Number(f.desconto_percent),
      valor_hora_extra: Number(f.valor_hora_extra),
      admitido_em: f.admitido_em,
      saiu_em: f.saiu_em,
      notas: f.notas ?? "",
      is_active: f.is_active,
    });
    setOpen(true);
  };

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      await saveFuncionario.mutateAsync({ ...parsed.data, id: editing?.id });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- view */

  return (
    <div>
      <PageHeader
        title="Funcionários"
        description="Cadastro de pessoal, presenças diárias e folha salarial mensal"
        actions={
          podeGerir ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo funcionário
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserCog} label="Funcionários activos" value={String(activos.length)} />
        <StatCard
          icon={CalendarCheck}
          label={`Presenças em ${dia.split("-").reverse().join("/")}`}
          value={`${presencasDia.filter((p) => p.estado === "presente" || p.estado === "meio_periodo").length}/${activos.length}`}
        />
        <StatCard icon={XCircle} label={`Faltas no mês`} value={String(totalFaltas)} />
        <StatCard icon={Wallet} label="Folha do mês (líquido)" value={fmt(totalFolha)} />
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Cadastro</TabsTrigger>
          <TabsTrigger value="presencas">Presenças</TabsTrigger>
          <TabsTrigger value="salarios">Salários</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------ cadastro */}
        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por nome, cargo ou código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-right">Salário base</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          A carregar…
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && filtrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Nenhum funcionário registado.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtrados.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="font-medium">{f.nome}</div>
                          {f.codigo && (
                            <div className="text-xs text-muted-foreground">#{f.codigo}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{f.cargo ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{f.turno ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {f.telefone ?? f.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(Number(f.salario_base))}
                        </TableCell>
                        <TableCell>
                          {f.is_active ? (
                            <Badge variant="secondary">Activo</Badge>
                          ) : (
                            <Badge variant="outline">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {podeGerir && (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setConfirmDelete(f)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------- presenças */}
        <TabsContent value="presencas" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Dia">
              <Input
                type="date"
                className="w-44"
                value={dia}
                onChange={(e) => setDia(e.target.value || hoje())}
              />
            </Field>
            <Button variant="outline" size="sm" onClick={() => marcarTodos("presente")}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar todos presentes
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="w-56">Estado do dia</TableHead>
                      <TableHead className="w-32">Horas extra</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          Registe funcionários para marcar presenças.
                        </TableCell>
                      </TableRow>
                    )}
                    {activos.map((f) => {
                      const p = presencaDoDia.get(f.id);
                      const info = p ? estadoInfo(p.estado) : null;
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <div className="font-medium">{f.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {f.cargo ?? "—"}
                              {info && (
                                <span className={`ml-2 rounded px-1.5 py-0.5 ${info.className}`}>
                                  {info.label}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p?.estado ?? ""}
                              onValueChange={(v) =>
                                marcarPresenca.mutate({ funcionario_id: f.id, estado: v as Estado })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Por marcar" />
                              </SelectTrigger>
                              <SelectContent>
                                {ESTADOS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              disabled={!p}
                              defaultValue={p?.horas_extra ?? 0}
                              key={`${f.id}-${dia}-${p?.horas_extra ?? "x"}`}
                              onBlur={(e) =>
                                p &&
                                marcarPresenca.mutate({
                                  funcionario_id: f.id,
                                  estado: p.estado,
                                  horas_extra: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={p ? "Notas do dia…" : "Marque o estado primeiro"}
                              disabled={!p}
                              defaultValue={p?.observacoes ?? ""}
                              key={`obs-${f.id}-${dia}-${p?.id ?? "x"}`}
                              onBlur={(e) =>
                                p &&
                                marcarPresenca.mutate({
                                  funcionario_id: f.id,
                                  estado: p.estado,
                                  observacoes: e.target.value || null,
                                })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------ salários */}
        <TabsContent value="salarios" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label="Mês de referência">
              <Input
                type="month"
                className="w-48"
                value={mes}
                onChange={(e) => setMes(e.target.value || mesAtual())}
              />
            </Field>
            <p className="text-sm text-muted-foreground">
              {diasDecorridos(mes)} de {diasDoMes(mes)} dias decorridos
            </p>
          </div>

          {folha.some(({ calc }) => calc.diasSemRegisto > 0) && (
            <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-semibold text-amber-700 dark:text-amber-400">Assiduidade incompleta — cálculo provisório</div>
              <p className="mt-1 text-muted-foreground">
                Existem dias decorridos sem registo de presença, falta, folga, férias ou licença.
                Estes dias não são presumidos como trabalhados. Complete os registos antes de aprovar a folha salarial.
              </p>
              <ul className="mt-2 space-y-1">
                {folha.filter(({ calc }) => calc.diasSemRegisto > 0).map(({ f, calc }) => (
                  <li key={f.id}>{f.nome}: {calc.diasSemRegisto} dia(s) sem registo</li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Folha salarial — {mes}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Subsídios</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-right">Desc. faltas</TableHead>
                      <TableHead className="text-right">H. extra</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {folha.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Sem funcionários activos.
                        </TableCell>
                      </TableRow>
                    )}
                    {folha.map(({ f, calc }) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="font-medium">{f.nome}</div>
                          <div className="text-xs text-muted-foreground">{f.cargo ?? "—"}</div>
                          {calc.diasSemRegisto > 0 && (
                            <Badge variant="outline" className="mt-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
                              {calc.diasSemRegisto} dia(s) por registar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{fmt(Number(f.salario_base))}</TableCell>
                        <TableCell className="text-right">{fmt(Number(f.subsidios))}</TableCell>
                        <TableCell className="text-center">
                          {calc.faltas > 0 ? (
                            <Badge variant="destructive">{calc.faltas}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {calc.descontoFaltas > 0 ? `- ${fmt(calc.descontoFaltas)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {calc.extras > 0 ? fmt(calc.extras) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {calc.descontoPercent > 0 ? `- ${fmt(calc.descontoPercent)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(calc.liquido)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {folha.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-medium">
                          Total da folha
                        </TableCell>
                        <TableCell className="text-right text-lg font-bold text-primary">
                          {fmt(totalFolha)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            O líquido considera o salário base e subsídios, desconta os dias de falta não
            justificada (valor/dia = base ÷ dias do mês), soma as horas extra registadas e aplica a
            percentagem de descontos configurada em cada funcionário.
          </p>
        </TabsContent>
      </Tabs>

      {/* ----------------------------------------------------------- diálogo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
            <DialogDescription>
              Dados pessoais, contrato e valores usados no cálculo do salário mensal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome completo *">
                <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} />
              </Field>
            </div>
            <Field label="Código interno">
              <Input value={form.codigo ?? ""} onChange={(e) => update("codigo", e.target.value)} />
            </Field>
            <Field label="Cargo">
              <Input value={form.cargo ?? ""} onChange={(e) => update("cargo", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.telefone ?? ""}
                onChange={(e) => update("telefone", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Documento (BI / NUIT)">
              <Input
                value={form.documento ?? ""}
                onChange={(e) => update("documento", e.target.value)}
              />
            </Field>
            <Field label="Turno">
              <Input
                placeholder="Manhã, Tarde, Noite…"
                value={form.turno ?? ""}
                onChange={(e) => update("turno", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Morada">
                <Input
                  value={form.morada ?? ""}
                  onChange={(e) => update("morada", e.target.value)}
                />
              </Field>
            </div>
            <Field label={`Salário base (${moeda})`}>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.salario_base}
                onChange={(e) => update("salario_base", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label={`Subsídios (${moeda})`}>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.subsidios}
                onChange={(e) => update("subsidios", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Descontos (%)">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.desconto_percent}
                onChange={(e) => update("desconto_percent", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label={`Valor da hora extra (${moeda})`}>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.valor_hora_extra}
                onChange={(e) => update("valor_hora_extra", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Admitido em">
              <Input
                type="date"
                value={form.admitido_em ?? ""}
                onChange={(e) => update("admitido_em", e.target.value || null)}
              />
            </Field>
            <Field label="Saiu em">
              <Input
                type="date"
                value={form.saiu_em ?? ""}
                onChange={(e) => update("saiu_em", e.target.value || null)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notas">
                <Textarea
                  rows={3}
                  value={form.notas ?? ""}
                  onChange={(e) => update("notas", e.target.value)}
                />
              </Field>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => update("is_active", v)}
                id="activo"
              />
              <Label htmlFor="activo">Funcionário activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as presenças registadas deste funcionário serão eliminadas. Esta acção não pode
              ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && removerFuncionario.mutate(confirmDelete.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
