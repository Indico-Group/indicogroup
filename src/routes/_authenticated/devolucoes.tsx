import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registarAuditoria } from "@/lib/auditoria";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/devolucoes")({
  head: () => ({ meta: [{ title: "Devoluções — INDICO GROUP" }, { name: "description", content: "Devoluções de produtos vendidos." }] }),
  component: DevolucoesPage,
});

type Metodo = "dinheiro" | "mpesa" | "emola" | "pos" | "transferencia";

function DevolucoesPage() {
  const qc = useQueryClient();
  const { roles } = usePermissions();
  const pode = roles.some((r) => ["admin", "gerente", "supervisor"].includes(r));
  const [numero, setNumero] = useState("");
  const [venda, setVenda] = useState<{ id: string; numero: number; status: string } | null>(null);
  const [itens, setItens] = useState<{ id: string; nome_produto: string; quantidade: number; subtotal: number }[]>([]);
  const [sel, setSel] = useState<string>("");
  const [qtd, setQtd] = useState("1");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [repor, setRepor] = useState(true);
  const [metodo, setMetodo] = useState<Metodo>("dinheiro");

  const { data: hist = [] } = useQuery({
    queryKey: ["devolucoes"],
    queryFn: async () => (await supabase.from("devolucoes").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const procurar = async () => {
    const { data } = await supabase.from("vendas").select("id,numero,status").eq("numero", Number(numero)).maybeSingle();
    if (!data) { setVenda(null); return toast.error("Venda não encontrada"); }
    setVenda(data);
    const { data: it } = await supabase.from("venda_itens").select("id,nome_produto,quantidade,subtotal").eq("venda_id", data.id);
    setItens((it ?? []).map((x) => ({ ...x, quantidade: Number(x.quantidade), subtotal: Number(x.subtotal) })));
    setSel("");
  };

  const registar = async () => {
    const it = itens.find((i) => i.id === sel);
    if (!venda || !it) return toast.error("Escolha o item");
    if (!motivo.trim()) return toast.error("Indique o motivo");
    const { error } = await supabase.from("devolucoes").insert({
      venda_id: venda.id, venda_item_id: it.id, produto_id: "00000000-0000-0000-0000-000000000000",
      nome_produto: it.nome_produto, quantidade: Number(qtd), valor: Number(valor) || 0,
      motivo: motivo.trim(), repor_stock: repor, metodo: Number(valor) > 0 ? metodo : null,
    });
    if (error) return toast.error(error.message);
    registarAuditoria({ modulo: "Devoluções", acao: "registar", entidade: "venda", entidade_id: venda.id, descricao: `${qtd}× ${it.nome_produto} da venda #${venda.numero}` });
    toast.success("Devolução registada");
    setMotivo(""); setValor(""); setQtd("1");
    qc.invalidateQueries({ queryKey: ["devolucoes"] });
  };

  const item = itens.find((i) => i.id === sel);
  return (
    <div>
      <PageHeader title="Devoluções" description="Devolve itens de vendas pagas, repõe stock e regista o reembolso no Financeiro" />
      {pode && (
        <Card className="mb-4"><CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <Input className="w-40" type="number" placeholder="Nº da venda" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Button variant="outline" onClick={procurar}>Procurar</Button>
          </div>
          {venda && (venda.status !== "paga" ? <p className="text-sm text-destructive">Só vendas pagas podem ter devoluções (estado: {venda.status}).</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sel} onChange={(e) => {
                setSel(e.target.value);
                const i = itens.find((x) => x.id === e.target.value);
                if (i) setValor((i.subtotal / i.quantidade).toFixed(2));
              }}>
                <option value="">Escolha o item…</option>
                {itens.map((i) => <option key={i.id} value={i.id}>{i.quantidade}× {i.nome_produto} — {i.subtotal.toFixed(2)}</option>)}
              </select>
              <Input type="number" placeholder="Quantidade" value={qtd} onChange={(e) => { setQtd(e.target.value); if (item) setValor(((item.subtotal / item.quantidade) * Number(e.target.value)).toFixed(2)); }} />
              <Input type="number" placeholder="Valor a reembolsar" value={valor} onChange={(e) => setValor(e.target.value)} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
                <option value="dinheiro">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="pos">POS</option><option value="transferencia">Transferência</option>
              </select>
              <Input className="sm:col-span-2" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={repor} onCheckedChange={(v) => setRepor(!!v)} />Repor no stock</label>
              <Button onClick={registar}>Registar devolução</Button>
            </div>
          ))}
        </CardContent></Card>
      )}
      <Card><Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Reembolso</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
        <TableBody>
          {hist.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem devoluções.</TableCell></TableRow>}
          {hist.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{new Date(d.created_at).toLocaleString("pt-PT")}</TableCell>
              <TableCell>{d.nome_produto}</TableCell><TableCell>{Number(d.quantidade)}</TableCell>
              <TableCell>{Number(d.valor).toFixed(2)}</TableCell><TableCell>{d.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>
    </div>
  );
}
