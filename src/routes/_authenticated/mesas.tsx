import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registarAuditoria } from "@/lib/auditoria";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/mesas")({
  head: () => ({ meta: [{ title: "Mesas — INDICO GROUP" }, { name: "description", content: "Gestão de mesas do restaurante e bar." }] }),
  component: MesasPage,
});

function MesasPage() {
  const qc = useQueryClient();
  const { canDo } = usePermissions();
  const pode = canDo("gerirCatalogo");
  const [f, setF] = useState({ numero: "", lugares: "4", zona: "" });

  const { data: mesas = [] } = useQuery({
    queryKey: ["mesas"],
    queryFn: async () => (await supabase.from("mesas").select("*").order("numero")).data ?? [],
  });
  const { data: abertas = [] } = useQuery({
    queryKey: ["mesas-abertas"],
    refetchInterval: 15000,
    queryFn: async () =>
      (await supabase.from("vendas").select("mesa,total").eq("status", "aberta").eq("tipo", "mesa")).data ?? [],
  });

  const criar = async () => {
    if (!f.numero.trim()) return toast.error("Indique o número da mesa");
    const { error } = await supabase.from("mesas").insert({ numero: f.numero.trim(), lugares: Number(f.lugares) || 1, zona: f.zona || null });
    if (error) return toast.error(error.message);
    registarAuditoria({ modulo: "Mesas", acao: "criar", descricao: `Mesa ${f.numero}` });
    setF({ numero: "", lugares: "4", zona: "" });
    qc.invalidateQueries({ queryKey: ["mesas"] });
    toast.success("Mesa criada");
  };
  const alternar = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("mesas").update({ is_active: !ativo }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["mesas"] });
  };

  return (
    <div>
      <PageHeader title="Mesas" description="Ocupação em tempo real a partir das vendas abertas por mesa" />
      {pode && (
        <Card className="mb-4"><CardContent className="flex flex-wrap gap-2 p-4">
          <Input className="w-32" placeholder="Número" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
          <Input className="w-28" type="number" placeholder="Lugares" value={f.lugares} onChange={(e) => setF({ ...f, lugares: e.target.value })} />
          <Input className="w-48" placeholder="Zona (ex.: Esplanada)" value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })} />
          <Button onClick={criar}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </CardContent></Card>
      )}
      {mesas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma mesa registada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {mesas.map((m) => {
            const ab = abertas.filter((a) => a.mesa === m.numero);
            const ocupada = ab.length > 0;
            return (
              <Card key={m.id} className={!m.is_active ? "opacity-50" : ocupada ? "border-destructive" : "border-success"}>
                <CardContent className="space-y-1 p-4">
                  <p className="text-2xl font-bold">{m.numero}</p>
                  <p className="text-xs text-muted-foreground">{m.lugares} lugares{m.zona ? ` • ${m.zona}` : ""}</p>
                  <Badge variant={ocupada ? "destructive" : "secondary"}>{!m.is_active ? "Inativa" : ocupada ? "Ocupada" : "Livre"}</Badge>
                  {ocupada && <p className="text-sm font-medium">{ab.reduce((s, a) => s + Number(a.total), 0).toFixed(2)} MT</p>}
                  {pode && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => alternar(m.id, m.is_active)}>{m.is_active ? "Desativar" : "Ativar"}</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
