import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Package, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Aldeia Mesa" },
      { name: "description", content: "Gestão de produtos do bar e restaurante Aldeia Mesa: cadastro, estoque, preços e fotos." },
    ],
  }),
  component: ProdutosPage,
});

const UNIDADES = ["un", "kg", "g", "l", "ml", "cx", "pct", "dz"];

type Produto = {
  id: string;
  codigo: string | null;
  codigo_barras: string | null;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  fornecedor_id: string | null;
  preco_compra: number;
  preco_venda: number;
  lucro: number | null;
  estoque_atual: number;
  estoque_minimo: number;
  unidade: string;
  foto_url: string | null;
  is_active: boolean;
};

const produtoSchema = z.object({
  codigo: z.string().trim().max(50).optional().nullable(),
  codigo_barras: z.string().trim().max(50).optional().nullable(),
  nome: z.string().trim().min(2, "Nome obrigatório").max(150),
  descricao: z.string().trim().max(500).optional().nullable(),
  categoria_id: z.string().uuid().optional().nullable(),
  fornecedor_id: z.string().uuid().optional().nullable(),
  preco_compra: z.number().min(0, "Preço inválido"),
  preco_venda: z.number().min(0, "Preço inválido"),
  estoque_atual: z.number().min(0),
  estoque_minimo: z.number().min(0),
  unidade: z.string().min(1).max(10),
  is_active: z.boolean(),
});

type FormState = {
  codigo: string;
  codigo_barras: string;
  nome: string;
  descricao: string;
  categoria_id: string;
  fornecedor_id: string;
  preco_compra: string;
  preco_venda: string;
  estoque_atual: string;
  estoque_minimo: string;
  unidade: string;
  is_active: boolean;
  foto_url: string | null;
};

const emptyForm: FormState = {
  codigo: "",
  codigo_barras: "",
  nome: "",
  descricao: "",
  categoria_id: "",
  fornecedor_id: "",
  preco_compra: "0",
  preco_venda: "0",
  estoque_atual: "0",
  estoque_minimo: "0",
  unidade: "un",
  is_active: true,
  foto_url: null,
};

function formatMZN(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" }).format(v || 0);
}

function ProdutosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Produto | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  // Signed URLs for photos
  useEffect(() => {
    const missing = produtos.filter((p) => p.foto_url && !signedUrls[p.id]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const p of missing) {
        if (!p.foto_url) continue;
        const { data } = await supabase.storage.from("produtos").createSignedUrl(p.foto_url, 3600);
        if (data?.signedUrl) updates[p.id] = data.signedUrl;
      }
      if (Object.keys(updates).length) setSignedUrls((s) => ({ ...s, ...updates }));
    })();
  }, [produtos, signedUrls]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return produtos;
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        p.codigo?.toLowerCase().includes(t) ||
        p.codigo_barras?.toLowerCase().includes(t),
    );
  }, [produtos, search]);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Produto) => {
    setEditing(p);
    setForm({
      codigo: p.codigo ?? "",
      codigo_barras: p.codigo_barras ?? "",
      nome: p.nome,
      descricao: p.descricao ?? "",
      categoria_id: p.categoria_id ?? "",
      fornecedor_id: p.fornecedor_id ?? "",
      preco_compra: String(p.preco_compra),
      preco_venda: String(p.preco_venda),
      estoque_atual: String(p.estoque_atual),
      estoque_minimo: String(p.estoque_minimo),
      unidade: p.unidade,
      is_active: p.is_active,
      foto_url: p.foto_url,
    });
    setOpen(true);
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("produtos").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (error) throw error;
      setForm((f) => ({ ...f, foto_url: path }));
      toast.success("Foto carregada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar foto");
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = produtoSchema.parse({
        codigo: form.codigo.trim() || null,
        codigo_barras: form.codigo_barras.trim() || null,
        nome: form.nome,
        descricao: form.descricao.trim() || null,
        categoria_id: form.categoria_id || null,
        fornecedor_id: form.fornecedor_id || null,
        preco_compra: Number(form.preco_compra),
        preco_venda: Number(form.preco_venda),
        estoque_atual: Number(form.estoque_atual),
        estoque_minimo: Number(form.estoque_minimo),
        unidade: form.unidade,
        is_active: form.is_active,
      });
      const payload = { ...parsed, foto_url: form.foto_url };
      if (editing) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      toast.success(editing ? "Produto actualizado" : "Produto criado");
      setOpen(false);
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.errors[0].message);
      else toast.error(e.message || "Erro ao guardar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto removido");
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const lucro = Number(form.preco_venda) - Number(form.preco_compra);
  const margem = Number(form.preco_venda) > 0 ? (lucro / Number(form.preco_venda)) * 100 : 0;

  const handleSubmit = () => {
    setSaving(true);
    saveMutation.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo completo do bar e restaurante"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, código ou código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} de {produtos.length} produtos
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Compra</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                      A carregar...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => {
                  const baixo = p.estoque_atual <= p.estoque_minimo;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {p.foto_url && signedUrls[p.id] ? (
                            <img src={signedUrls[p.id]} alt={p.nome} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.codigo && <span>Cód: {p.codigo}</span>}
                          {p.codigo && p.codigo_barras && <span> · </span>}
                          {p.codigo_barras && <span>EAN: {p.codigo_barras}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.categoria_id ? catMap.get(p.categoria_id) : "—"}</TableCell>
                      <TableCell className="text-sm">{p.fornecedor_id ? fornMap.get(p.fornecedor_id) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMZN(p.preco_compra)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatMZN(p.preco_venda)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatMZN(p.lucro ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={"inline-flex items-center gap-1 tabular-nums " + (baixo ? "text-destructive" : "")}>
                          {baixo && <AlertTriangle className="h-3 w-3" />}
                          {p.estoque_atual} {p.unidade}
                        </div>
                        <div className="text-xs text-muted-foreground">min {p.estoque_minimo}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha os dados do produto.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="md:col-span-2 grid gap-2">
              <Label>Foto do Produto</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {form.foto_url ? (
                    <PhotoPreview path={form.foto_url} />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="foto" className="cursor-pointer">
                    <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      {uploading ? "A carregar..." : "Escolher foto"}
                    </div>
                    <input
                      id="foto"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                    />
                  </Label>
                  {form.foto_url && (
                    <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, foto_url: null }))}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Código Interno</Label>
              <Input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Código de Barras (EAN)</Label>
              <Input value={form.codigo_barras} onChange={(e) => setForm((f) => ({ ...f, codigo_barras: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Unidade de Medida</Label>
              <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={form.categoria_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem categoria —</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fornecedor</Label>
              <Select
                value={form.fornecedor_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, fornecedor_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem fornecedor —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Preço de Compra (MZN)</Label>
              <Input type="number" step="0.01" min="0" value={form.preco_compra}
                onChange={(e) => setForm((f) => ({ ...f, preco_compra: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Preço de Venda (MZN)</Label>
              <Input type="number" step="0.01" min="0" value={form.preco_venda}
                onChange={(e) => setForm((f) => ({ ...f, preco_venda: e.target.value }))} />
            </div>

            <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro por unidade:</span>
                <span className="font-medium text-emerald-600 tabular-nums">
                  {formatMZN(lucro)} ({margem.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Estoque Actual</Label>
              <Input type="number" step="0.001" min="0" value={form.estoque_atual}
                onChange={(e) => setForm((f) => ({ ...f, estoque_atual: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Estoque Mínimo</Label>
              <Input type="number" step="0.001" min="0" value={form.estoque_minimo}
                onChange={(e) => setForm((f) => ({ ...f, estoque_minimo: e.target.value }))} />
            </div>

            <div className="md:col-span-2 grid gap-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Produto activo</div>
                <div className="text-xs text-muted-foreground">Produtos inactivos não aparecem no PDV</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || uploading}>
              {saving ? "A guardar..." : editing ? "Guardar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto "{confirmDelete?.nome}" será removido permanentemente. Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PhotoPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("produtos").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return <Package className="h-8 w-8 text-muted-foreground" />;
  return <img src={url} alt="produto" className="h-full w-full object-cover" />;
}
