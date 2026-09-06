import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { Search, FileDown, Printer, Sheet, ShieldCheck, Activity, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { registarAuditoria as _unused, exportarCsv } from "@/lib/auditoria";
import { getEmpresaDoc, criarRelatorioPdf, imprimirPdf, nomeFicheiro } from "@/lib/pdf";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Aldeia Mesa" },
      { name: "description", content: "Histórico completo de operações do sistema: quem fez o quê, quando e em que módulo." },
      { property: "og:title", content: "Auditoria — Aldeia Mesa" },
      { property: "og:description", content: "Registo permanente de todas as operações do Aldeia Mesa, com filtros e exportação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaPage,
});

type Registo = {
  id: string;
  user_nome: string | null;
  modulo: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  descricao: string | null;
  detalhes: unknown;
  created_at: string;
};

const ACAO_CLASSE: Record<string, string> = {
  criar: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  actualizar: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  receber: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelar: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  apagar: "bg-destructive/10 text-destructive border-destructive/20",
  exportar: "bg-muted text-muted-foreground border-border",
};

function dias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function AuditoriaPage() {
  const [search, setSearch] = useState("");
  const [modulo, setModulo] = useState("todos");
  const [periodo, setPeriodo] = useState("30");
  const [detalhe, setDetalhe] = useState<Registo | null>(null);

  const { data: registos = [], isLoading } = useQuery({
    queryKey: ["auditoria", periodo],
    queryFn: async () => {
      let q = supabase.from("auditoria").select("*").order("created_at", { ascending: false }).limit(1000);
      if (periodo !== "tudo") q = q.gte("created_at", dias(Number(periodo)));
      const { data, error } = await q;
      if (error) throw error;
      return data as Registo[];
    },
  });

  const modulos = useMemo(
    () => Array.from(new Set(registos.map((r) => r.modulo))).sort(),
    [registos],
  );

  const filtrados = useMemo(() => {
    const t = search.trim().toLowerCase();
    return registos.filter((r) => {
      if (modulo !== "todos" && r.modulo !== modulo) return false;
      if (!t) return true;
      return [r.user_nome, r.modulo, r.acao, r.entidade, r.descricao]
        .some((v) => (v ?? "").toLowerCase().includes(t));
    });
  }, [registos, modulo, search]);

  const stats = useMemo(() => ({
    total: filtrados.length,
    utilizadores: new Set(filtrados.map((r) => r.user_nome ?? "—")).size,
    modulos: new Set(filtrados.map((r) => r.modulo)).size,
  }), [filtrados]);

  const colunas = ["Data/Hora", "Utilizador", "Módulo", "Acção", "Entidade", "Descrição"];
  const linhas = () =>
    filtrados.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: pt }),
      r.user_nome ?? "—",
      r.modulo,
      r.acao,
      r.entidade ?? "—",
      r.descricao ?? "—",
    ]);

  const exportarPdf = async (imprimir = false) => {
    if (filtrados.length === 0) return toast.error("Sem registos para exportar");
    try {
      const empresa = await getEmpresaDoc();
      const doc = criarRelatorioPdf(empresa, {
        titulo: "Registo de Auditoria",
        subtitulo: `${filtrados.length} evento(s)${modulo !== "todos" ? ` · Módulo ${modulo}` : ""}`,
        colunas,
        linhas: linhas(),
        orientacao: "landscape",
      });
      if (imprimir) imprimirPdf(doc);
      else doc.save(nomeFicheiro("auditoria"));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria" description="Registo permanente de todas as operações do sistema" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Activity} label="Eventos" value={String(stats.total)} />
        <StatCard icon={Users} label="Utilizadores" value={String(stats.utilizadores)} />
        <StatCard icon={ShieldCheck} label="Módulos" value={String(stats.modulos)} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar por utilizador, acção ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={modulo} onValueChange={setModulo}>
          <SelectTrigger className="lg:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="lg:w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="tudo">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportarCsv("auditoria", colunas, linhas())}>
            <Sheet className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => exportarPdf(false)}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="icon" title="Imprimir" onClick={() => exportarPdf(true)}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Data/Hora</TableHead>
                <TableHead>Utilizador</TableHead>
                <TableHead className="hidden md:table-cell">Módulo</TableHead>
                <TableHead>Acção</TableHead>
                <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Sem eventos registados no período.</TableCell></TableRow>
              )}
              {filtrados.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetalhe(r)}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                  </TableCell>
                  <TableCell className="font-medium">{r.user_nome ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm capitalize">{r.modulo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ACAO_CLASSE[r.acao] ?? "bg-muted text-muted-foreground border-border"}>
                      {r.acao}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.descricao ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{detalhe?.modulo} · {detalhe?.acao}</DialogTitle>
            <DialogDescription>
              {detalhe?.user_nome ?? "—"} ·{" "}
              {detalhe && format(new Date(detalhe.created_at), "dd MMM yyyy HH:mm", { locale: pt })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {detalhe?.descricao && <p>{detalhe.descricao}</p>}
            {detalhe?.entidade && (
              <p className="text-muted-foreground">
                Entidade: {detalhe.entidade}{detalhe.entidade_id ? ` (${detalhe.entidade_id})` : ""}
              </p>
            )}
            {!!detalhe?.detalhes && (
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">
                {JSON.stringify(detalhe.detalhes, null, 2)}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
