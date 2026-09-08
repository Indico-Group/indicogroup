import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PeriodoKey = "hoje" | "ontem" | "semana" | "mes" | "ano" | "custom";

export const PERIODO_LABELS: Record<PeriodoKey, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
  custom: "Personalizado",
};

export interface Range {
  inicio: Date;
  fim: Date;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveRange(key: PeriodoKey, custom?: { de?: string; ate?: string }): Range {
  const hoje = new Date();
  switch (key) {
    case "hoje":
      return { inicio: startOfDay(hoje), fim: endOfDay(hoje) };
    case "ontem": {
      const o = new Date(hoje);
      o.setDate(o.getDate() - 1);
      return { inicio: startOfDay(o), fim: endOfDay(o) };
    }
    case "semana": {
      const i = new Date(hoje);
      const dow = (i.getDay() + 6) % 7; // segunda = 0
      i.setDate(i.getDate() - dow);
      return { inicio: startOfDay(i), fim: endOfDay(hoje) };
    }
    case "mes": {
      const i = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: startOfDay(i), fim: endOfDay(hoje) };
    }
    case "ano": {
      const i = new Date(hoje.getFullYear(), 0, 1);
      return { inicio: startOfDay(i), fim: endOfDay(hoje) };
    }
    case "custom": {
      const i = custom?.de ? new Date(custom.de) : startOfDay(hoje);
      const f = custom?.ate ? new Date(custom.ate) : hoje;
      return { inicio: startOfDay(i), fim: endOfDay(f) };
    }
  }
}

/** Período imediatamente anterior, com a mesma duração. */
export function previousRange(r: Range): Range {
  const dur = r.fim.getTime() - r.inicio.getTime();
  return { inicio: new Date(r.inicio.getTime() - dur - 1), fim: new Date(r.inicio.getTime() - 1) };
}

export const fmtMZN = (v: number, moeda = "MZN") =>
  new Intl.NumberFormat("pt-MZ", { style: "currency", currency: moeda, maximumFractionDigits: 0 }).format(v || 0);

export const fmtNum = (v: number) => new Intl.NumberFormat("pt-MZ").format(v || 0);

export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

type VendaRow = {
  id: string;
  numero: number;
  total: number;
  status: string;
  tipo: string;
  metodo_pagamento: string | null;
  created_at: string;
  paga_em: string | null;
};

async function fetchVendas(r: Range) {
  const { data, error } = await supabase
    .from("vendas")
    .select("id, numero, total, status, tipo, metodo_pagamento, created_at, paga_em")
    .gte("created_at", r.inicio.toISOString())
    .lte("created_at", r.fim.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VendaRow[];
}

export function useDashboard(range: Range) {
  const anterior = previousRange(range);

  const vendas = useQuery({
    queryKey: ["dash-vendas", range.inicio.toISOString(), range.fim.toISOString()],
    queryFn: () => fetchVendas(range),
    refetchInterval: 60_000,
  });

  const vendasAnt = useQuery({
    queryKey: ["dash-vendas-ant", anterior.inicio.toISOString(), anterior.fim.toISOString()],
    queryFn: () => fetchVendas(anterior),
    staleTime: 60_000,
  });

  const itens = useQuery({
    queryKey: ["dash-itens", range.inicio.toISOString(), range.fim.toISOString()],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_itens")
        .select(
          "quantidade, subtotal, produto_id, nome_produto, created_at, vendas!inner(status, created_at), produtos(preco_compra, categoria_id, categorias(nome))",
        )
        .gte("created_at", range.inicio.toISOString())
        .lte("created_at", range.fim.toISOString());
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        quantidade: number;
        subtotal: number;
        produto_id: string;
        nome_produto: string;
        vendas: { status: string; created_at: string } | null;
        produtos: { preco_compra: number; categoria_id: string | null; categorias: { nome: string } | null } | null;
      }>;
    },
  });

  const pagamentos = useQuery({
    queryKey: ["dash-pagamentos", range.inicio.toISOString(), range.fim.toISOString()],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_pagamentos")
        .select("metodo, valor, created_at")
        .gte("created_at", range.inicio.toISOString())
        .lte("created_at", range.fim.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const produtos = useQuery({
    queryKey: ["dash-produtos"],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, estoque_atual, estoque_minimo, preco_compra, preco_venda, unidade, is_active, categorias(nome)")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        nome: string;
        estoque_atual: number;
        estoque_minimo: number;
        preco_compra: number;
        preco_venda: number;
        unidade: string;
        categorias: { nome: string } | null;
      }>;
    },
  });

  const financeiro = useQuery({
    queryKey: ["dash-financeiro"],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, tipo, status, valor, vencimento, pago_em, created_at")
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const caixa = useQuery({
    queryKey: ["dash-caixa"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: sessoes, error } = await supabase
        .from("caixa_sessoes")
        .select("id, status, valor_abertura, valor_fechamento, valor_esperado, diferenca, aberta_em, fechada_em")
        .order("aberta_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      const aberta = (sessoes ?? []).find((s) => s.status === "aberta") ?? null;
      let movimentos: Array<{ tipo: string; valor: number; motivo: string | null; created_at: string }> = [];
      if (aberta) {
        const { data: mv } = await supabase
          .from("caixa_movimentos")
          .select("tipo, valor, motivo, created_at")
          .eq("sessao_id", aberta.id)
          .order("created_at", { ascending: false });
        movimentos = mv ?? [];
      }
      return { sessoes: sessoes ?? [], aberta, movimentos };
    },
  });

  const movimentos = useQuery({
    queryKey: ["dash-movimentos"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("id, tipo, quantidade, motivo, created_at, produtos(nome)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        tipo: string;
        quantidade: number;
        motivo: string | null;
        created_at: string;
        produtos: { nome: string } | null;
      }>;
    },
  });

  const compras = useQuery({
    queryKey: ["dash-compras"],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("id, numero, total, status, created_at, fornecedores(nome)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        numero: number;
        total: number;
        status: string;
        created_at: string;
        fornecedores: { nome: string } | null;
      }>;
    },
  });

  const isLoading =
    vendas.isLoading || itens.isLoading || produtos.isLoading || financeiro.isLoading || caixa.isLoading;
  const error =
    vendas.error || itens.error || produtos.error || financeiro.error || caixa.error || pagamentos.error || null;

  const refetchAll = () => {
    void vendas.refetch();
    void vendasAnt.refetch();
    void itens.refetch();
    void pagamentos.refetch();
    void produtos.refetch();
    void financeiro.refetch();
    void caixa.refetch();
    void movimentos.refetch();
    void compras.refetch();
  };

  return {
    isLoading,
    error,
    refetchAll,
    isFetching:
      vendas.isFetching || itens.isFetching || produtos.isFetching || financeiro.isFetching || caixa.isFetching,
    vendas: vendas.data ?? [],
    vendasAnteriores: vendasAnt.data ?? [],
    itens: itens.data ?? [],
    pagamentos: pagamentos.data ?? [],
    produtos: produtos.data ?? [],
    financeiro: financeiro.data ?? [],
    caixa: caixa.data ?? { sessoes: [], aberta: null, movimentos: [] },
    movimentos: movimentos.data ?? [],
    compras: compras.data ?? [],
  };
}
