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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registarAuditoria } from "@/lib/auditoria";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/unidades")({
  head: () => ({ meta: [{ title: "Unidades de medida — INDICO GROUP" }, { name: "description", content: "Unidades de medida dos produtos." }] }),
  component: UnidadesPage,
});

function UnidadesPage() {
  const qc = useQueryClient();
  const pode = usePermissions().canDo("gerirCatalogo");
  const [f, setF] = useState({ nome: "", sigla: "" });
  const { data = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: async () => (await supabase.from("unidades_medida").select("*").order("nome")).data ?? [],
  });
  const criar = async () => {
    if (!f.nome.trim() || !f.sigla.trim()) return toast.error("Preencha nome e sigla");
    const { error } = await supabase.from("unidades_medida").insert({ nome: f.nome.trim(), sigla: f.sigla.trim() });
    if (error) return toast.error(error.code === "23505" ? "Sigla já existe" : error.message);
    registarAuditoria({ modulo: "Unidades", acao: "criar", descricao: `${f.nome} (${f.sigla})` });
    setF({ nome: "", sigla: "" });
    qc.invalidateQueries({ queryKey: ["unidades-medida"] });
  };
  const alternar = async (id: string, v: boolean) => {
    const { error } = await supabase.from("unidades_medida").update({ is_active: !v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["unidades-medida"] });
  };
  return (
    <div>
      <PageHeader title="Unidades de medida" description="Ex.: Quilograma – kg, Garrafa – gf" />
      {pode && (
        <Card className="mb-4"><CardContent className="flex flex-wrap gap-2 p-4">
          <Input className="w-56" placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <Input className="w-28" placeholder="Sigla" value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value })} />
          <Button onClick={criar}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </CardContent></Card>
      )}
      <Card><Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Sigla</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem unidades registadas.</TableCell></TableRow>}
          {data.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.nome}</TableCell><TableCell>{u.sigla}</TableCell>
              <TableCell>{u.is_active ? "Ativa" : "Inativa"}</TableCell>
              <TableCell className="text-right">{pode && <Button size="sm" variant="ghost" onClick={() => alternar(u.id, u.is_active)}>{u.is_active ? "Desativar" : "Ativar"}</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>
    </div>
  );
}
