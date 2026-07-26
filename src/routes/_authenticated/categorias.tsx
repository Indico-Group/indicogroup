import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Search, Tag, Tags, Wine, Beer, Coffee, Utensils,
  IceCream, Pizza, Sandwich, Soup, CupSoda, GlassWater, Cookie, Cake,
  Beef, Fish, Salad, Croissant, Package,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Aldeia Mesa" },
      { name: "description", content: "Organize os produtos do Aldeia Mesa em categorias com cores e ícones personalizados." },
    ],
  }),
  component: CategoriasPage,
});

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Tag, Tags, Wine, Beer, Coffee, Utensils, IceCream, Pizza, Sandwich, Soup,
  CupSoda, GlassWater, Cookie, Cake, Beef, Fish, Salad, Croissant, Package,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_PRESETS = [
  "#1E3A8A", "#2563EB", "#0EA5E9", "#059669", "#10B981", "#84CC16",
  "#EAB308", "#F59E0B", "#D97706", "#DC2626", "#EC4899", "#8B5CF6",
  "#6366F1", "#0F172A", "#64748B", "#B45309",
];

type Categoria = {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
  is_active: boolean;
  created_at: string;
};

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(80),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  icone: z.string().min(1),
  is_active: z.boolean(),
});

type FormState = { nome: string; cor: string; icone: string; is_active: boolean };
const emptyForm: FormState = { nome: "", cor: "#3B82F6", icone: "Tag", is_active: true };

function IconGlyph({ name, className }: { name: string | null; className?: string }) {
  const Icon = ICON_MAP[name ?? "Tag"] ?? Tag;
  return <Icon className={className} />;
}

function CategoriasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Categoria | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome, cor, icone, is_active, created_at")
        .order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["categorias-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("categoria_id");
      if (error) throw error;
      const c: Record<string, number> = {};
      for (const row of data as { categoria_id: string | null }[]) {
        if (row.categoria_id) c[row.categoria_id] = (c[row.categoria_id] ?? 0) + 1;
      }
      return c;
    },
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return categorias;
    return categorias.filter((c) => c.nome.toLowerCase().includes(t));
  }, [categorias, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      cor: c.cor ?? "#3B82F6",
      icone: c.icone ?? "Tag",
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      if (editing) {
        const { error } = await supabase.from("categorias").update(parsed).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categorias").insert(parsed);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["categorias-lookup"] });
      toast.success(editing ? "Categoria actualizada" : "Categoria criada");
      setOpen(false);
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.errors[0].message);
      else toast.error(e.message || "Erro ao guardar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["categorias-lookup"] });
      qc.invalidateQueries({ queryKey: ["categorias-counts"] });
      toast.success("Categoria removida");
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const handleSubmit = () => {
    setSaving(true);
    saveMutation.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  const handleDelete = (c: Categoria) => {
    if ((counts[c.id] ?? 0) > 0) {
      toast.error(`Categoria em uso por ${counts[c.id]} produto(s). Reatribua antes de remover.`);
      return;
    }
    setConfirmDelete(c);
  };

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Organize o menu por tipo de produto"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} de {categorias.length} categorias
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ícone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      A carregar...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Tags className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      Nenhuma categoria encontrada
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-md"
                        style={{ backgroundColor: (c.cor ?? "#3B82F6") + "22", color: c.cor ?? "#3B82F6" }}
                      >
                        <IconGlyph name={c.icone} className="h-5 w-5" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full border"
                          style={{ backgroundColor: c.cor ?? "#3B82F6" }}
                        />
                        <span className="text-xs text-muted-foreground">{c.cor}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant="secondary">{counts[c.id] ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription>Defina o nome, cor e ícone da categoria.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-lg"
                style={{ backgroundColor: form.cor + "22", color: form.cor }}
              >
                <IconGlyph name={form.icone} className="h-7 w-7" />
              </div>
              <div>
                <div className="font-medium">{form.nome || "Pré-visualização"}</div>
                <div className="text-xs text-muted-foreground">Como aparecerá no menu</div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Bebidas, Sobremesas..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, cor: c }))}
                    className={
                      "h-8 w-8 rounded-full border-2 transition " +
                      (form.cor.toLowerCase() === c.toLowerCase() ? "border-foreground scale-110" : "border-transparent")
                    }
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
                  className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-8 gap-2">
                {ICON_OPTIONS.map((name) => {
                  const Icon = ICON_MAP[name];
                  const selected = form.icone === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icone: name }))}
                      className={
                        "flex h-10 w-10 items-center justify-center rounded-md border transition " +
                        (selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")
                      }
                      title={name}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Categoria activa</Label>
                <p className="text-xs text-muted-foreground">Categorias inactivas não aparecem no cadastro de produtos.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "A guardar..." : editing ? "Actualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria <strong>{confirmDelete?.nome}</strong> será removida permanentemente. Esta acção não pode ser desfeita.
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
