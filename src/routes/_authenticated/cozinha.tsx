import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — INDICO GROUP" }, { name: "description", content: "Pedidos em preparação na cozinha." }] }),
  component: CozinhaPage,
});

const COLS = [
  { key: "pendente", label: "Pendentes", next: "preparacao", btn: "Iniciar" },
  { key: "preparacao", label: "Em preparação", next: "pronto", btn: "Pronto" },
  { key: "pronto", label: "Prontos", next: "entregue", btn: "Entregue" },
] as const;

function CozinhaPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["cozinha"],
    refetchInterval: 10000,
    queryFn: async () =>
      (await supabase.from("venda_itens")
        .select("id,nome_produto,quantidade,observacao,estado_cozinha,enviado_em,created_at,vendas(numero,mesa,tipo)")
        .in("estado_cozinha", ["pendente", "preparacao", "pronto"]).order("created_at")).data ?? [],
  });
  const mover = async (id: string, estado: string) => {
    const patch: { estado_cozinha: string; pronto_em?: string } = { estado_cozinha: estado };
    if (estado === "pronto") patch.pronto_em = new Date().toISOString();
    const { error } = await supabase.from("venda_itens").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cozinha"] });
  };
  return (
    <div>
      <PageHeader title="Cozinha" description="Atualiza a cada 10 segundos. Itens chegam quando o garçom os envia para a cozinha." />
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((c) => {
          const itens = data.filter((i) => i.estado_cozinha === c.key);
          return (
            <div key={c.key} className="space-y-2">
              <h2 className="font-semibold">{c.label} ({itens.length})</h2>
              {itens.length === 0 && <p className="text-sm text-muted-foreground">Nada aqui.</p>}
              {itens.map((i) => {
                const v = i.vendas as { numero: number; mesa: string | null; tipo: string } | null;
                return (
                  <Card key={i.id}><CardContent className="space-y-1 p-3">
                    <p className="font-medium">{Number(i.quantidade)}× {i.nome_produto}</p>
                    <p className="text-xs text-muted-foreground">Venda #{v?.numero} {v?.mesa ? `• Mesa ${v.mesa}` : `• ${v?.tipo ?? ""}`} • {new Date(i.enviado_em ?? i.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</p>
                    {i.observacao && <p className="text-xs italic">{i.observacao}</p>}
                    <Button size="sm" className="w-full" onClick={() => mover(i.id, c.next)}>{c.btn}</Button>
                  </CardContent></Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
