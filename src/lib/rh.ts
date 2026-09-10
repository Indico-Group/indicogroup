import {
  CheckCircle2, XCircle, Clock, Palmtree, Coffee, FileWarning, AlarmClock, Stethoscope,
} from "lucide-react";

import type { Database } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ tipos */

export type Funcionario = Database["public"]["Tables"]["funcionarios"]["Row"];
export type Presenca = Database["public"]["Tables"]["presencas"]["Row"];
export type Adiantamento = Database["public"]["Tables"]["adiantamentos"]["Row"];
export type FolhaSalarial = Database["public"]["Tables"]["folhas_salariais"]["Row"];
export type FolhaItem = Database["public"]["Tables"]["folha_itens"]["Row"];
export type HistoricoSalarial = Database["public"]["Tables"]["funcionario_salario_historico"]["Row"];
export type PresencaEstado = Database["public"]["Enums"]["presenca_estado"];
export type FolhaStatus = Database["public"]["Enums"]["folha_status"];
export type MetodoPagamento = Database["public"]["Enums"]["pagamento_metodo"];

/** Base de cálculo do valor/dia — alinhada com a função `gerar_folha` na base de dados. */
export const DIAS_BASE = 30;

export const ESTADOS: {
  value: PresencaEstado;
  label: string;
  curto: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}[] = [
  { value: "presente", label: "Presente", curto: "P", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  { value: "atraso", label: "Atraso", curto: "A", icon: AlarmClock, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { value: "meio_periodo", label: "Meio período", curto: "½", icon: Clock, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { value: "falta", label: "Falta", curto: "F", icon: XCircle, className: "bg-destructive/15 text-destructive" },
  { value: "falta_justificada", label: "Falta justificada", curto: "FJ", icon: FileWarning, className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  { value: "licenca", label: "Licença", curto: "L", icon: Stethoscope, className: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  { value: "ferias", label: "Férias", curto: "Fé", icon: Palmtree, className: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  { value: "folga", label: "Folga", curto: "Fo", icon: Coffee, className: "bg-muted text-muted-foreground" },
];

export const estadoInfo = (e: PresencaEstado) => ESTADOS.find((s) => s.value === e) ?? ESTADOS[0];

export const METODOS: { value: MetodoPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "emola", label: "e-Mola" },
  { value: "pos", label: "POS" },
  { value: "transferencia", label: "Transferência" },
  { value: "misto", label: "Misto" },
];

export const metodoLabel = (m?: string | null) => METODOS.find((x) => x.value === m)?.label ?? (m ?? "—");

export const FOLHA_STATUS: Record<FolhaStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  aprovada: { label: "Aprovada", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  fechada: { label: "Fechada", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  paga: { label: "Paga", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

/* ------------------------------------------------------------- utilitários */

export const pad = (n: number) => String(n).padStart(2, "0");
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const mesAtual = () => hoje().slice(0, 7);
export const mesLabel = (mes: string) => mes.split("-").reverse().join("/");
export const dataLabel = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export function diasDoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
export const inicioMes = (mes: string) => `${mes}-01`;
export const fimMes = (mes: string) => `${mes}-${pad(diasDoMes(mes))}`;

/** É uma falta injustificada (conta para desconto)? Espelha a regra de `gerar_folha`. */
export const isFaltaInjustificada = (p: Pick<Presenca, "estado" | "justificacao_estado">) =>
  p.estado === "falta" && (p.justificacao_estado ?? "") !== "aprovada";

export const isFaltaJustificada = (p: Pick<Presenca, "estado" | "justificacao_estado">) =>
  p.estado === "falta_justificada" || (p.estado === "falta" && p.justificacao_estado === "aprovada");

export type ResumoAssiduidade = {
  presentes: number;
  atrasos: number;
  minutosAtraso: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  horasExtra: number;
  registos: number;
};

export function resumirPresencas(presencas: Presenca[]): ResumoAssiduidade {
  const r: ResumoAssiduidade = { presentes: 0, atrasos: 0, minutosAtraso: 0, faltasJustificadas: 0, faltasInjustificadas: 0, horasExtra: 0, registos: presencas.length };
  for (const p of presencas) {
    if (p.estado === "presente" || p.estado === "meio_periodo" || p.estado === "atraso") r.presentes += 1;
    if (p.estado === "atraso") { r.atrasos += 1; r.minutosAtraso += Number(p.minutos_atraso ?? 0); }
    if (isFaltaJustificada(p)) r.faltasJustificadas += 1;
    if (isFaltaInjustificada(p)) r.faltasInjustificadas += 1;
    r.horasExtra += Number(p.horas_extra ?? 0);
  }
  return r;
}

export type CalculoSalario = ResumoAssiduidade & {
  valorDia: number;
  extras: number;
  descontoFaltas: number;
  outrosDescontos: number;
  adiantamentos: number;
  bruto: number;
  liquido: number;
};

/** Prévia do salário — mesma fórmula da função `gerar_folha` (base 30 dias). */
export function calcularSalario(f: Funcionario, presencas: Presenca[], adiantamentos = 0): CalculoSalario {
  const r = resumirPresencas(presencas);
  const base = Number(f.salario_base || 0);
  const valorDia = base / DIAS_BASE;
  const descontoFaltas = f.desconta_faltas ? round2(r.faltasInjustificadas * valorDia) : 0;
  const extras = round2(r.horasExtra * Number(f.valor_hora_extra || 0));
  const outrosDescontos = round2(Number(f.outros_descontos || 0) + (base * Number(f.desconto_percent || 0)) / 100);
  const bruto = round2(base + extras + Number(f.subsidios || 0) + Number(f.bonus || 0));
  const liquido = round2(bruto - descontoFaltas - adiantamentos - outrosDescontos);
  return { ...r, valorDia, extras, descontoFaltas, outrosDescontos, adiantamentos, bruto, liquido };
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function formatMoeda(v: number, moeda = "MZN") {
  return (
    new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0) +
    ` ${moeda}`
  );
}
