import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Pencil, Trash2, Search, ShieldCheck, KeyRound, ShieldAlert, UserPlus, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import {
  listUsuarios, criarUsuario, atualizarUsuario, redefinirSenha, removerUsuario,
} from "@/lib/usuarios.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Aldeia Mesa" },
      { name: "description", content: "Gerencie utilizadores, papéis e permissões do sistema Aldeia Mesa." },
    ],
  }),
  component: UsuariosPage,
});

type Role = "admin" | "gerente" | "supervisor" | "caixa" | "garcom" | "cozinha" | "estoque";

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
  { value: "gerente", label: "Gerente", desc: "Gestão operacional e catálogo" },
  { value: "supervisor", label: "Supervisor", desc: "Supervisão de turno" },
  { value: "caixa", label: "Caixa", desc: "Operar caixa e vendas" },
  { value: "garcom", label: "Garçom", desc: "Registar pedidos de mesa" },
  { value: "cozinha", label: "Cozinha", desc: "Ver e preparar pedidos" },
  { value: "estoque", label: "Estoque", desc: "Movimentos e inventário" },
];

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  gerente: "bg-gold text-gold-foreground",
  supervisor: "bg-emerald-600 text-white",
  caixa: "bg-blue-600 text-white",
  garcom: "bg-purple-600 text-white",
  cozinha: "bg-orange-600 text-white",
  estoque: "bg-slate-600 text-white",
};

type UserRow = Awaited<ReturnType<typeof listUsuarios>>[number];

type FormState = {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  position: string;
  shift: string;
  is_active: boolean;
  roles: Role[];
};

const emptyForm: FormState = {
  email: "",
  password: "",
  full_name: "",
  phone: "",
  position: "",
  shift: "",
  is_active: true,
  roles: ["caixa"],
};

function UsuariosPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listUsuarios);
  const fnCreate = useServerFn(criarUsuario);
  const fnUpdate = useServerFn(atualizarUsuario);
  const fnReset = useServerFn(redefinirSenha);
  const fnDelete = useServerFn(removerUsuario);

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [newPass, setNewPass] = useState("");

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => fetchList(),
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
      if (!t) return true;
      return (
        u.email.toLowerCase().includes(t) ||
        (u.profile?.full_name ?? "").toLowerCase().includes(t) ||
        (u.profile?.position ?? "").toLowerCase().includes(t)
      );
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.roles.includes("admin")).length;
    const inativos = users.filter((u) => u.profile && !u.profile.is_active).length;
    return { total, admins, inativos, ativos: total - inativos };
  }, [users]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: "",
      full_name: u.profile?.full_name ?? "",
      phone: u.profile?.phone ?? "",
      position: u.profile?.position ?? "",
      shift: u.profile?.shift ?? "",
      is_active: u.profile?.is_active ?? true,
      roles: u.roles.length ? (u.roles as Role[]) : ["caixa"],
    });
    setOpen(true);
  };

  const toggleRole = (role: Role) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.roles.length === 0) throw new Error("Seleccione pelo menos um papel");
      if (editing) {
        await fnUpdate({
          data: {
            id: editing.id,
            full_name: form.full_name,
            phone: form.phone || null,
            position: form.position || null,
            shift: form.shift || null,
            is_active: form.is_active,
            roles: form.roles,
          },
        });
      } else {
        await fnCreate({
          data: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || null,
            position: form.position || null,
            shift: form.shift || null,
            roles: form.roles,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(editing ? "Utilizador actualizado" : "Utilizador criado");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao guardar"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!resetFor) return;
      if (newPass.length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");
      await fnReset({ data: { id: resetFor.id, password: newPass } });
    },
    onSuccess: () => {
      toast.success("Senha redefinida");
      setResetFor(null);
      setNewPass("");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao redefinir"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fnDelete({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Utilizador removido");
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const handleSubmit = () => {
    setSaving(true);
    saveMutation.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Usuários & Permissões" description="Controlo de acessos ao sistema" />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <p className="font-medium">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              {(error as Error).message || "Apenas administradores podem gerir utilizadores."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Usuários & Permissões"
        description="Gerencie contas, papéis e acessos ao sistema"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <UserPlus className="h-4 w-4" /> Novo Usuário
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<UsersIcon className="h-4 w-4" />} />
        <StatCard label="Administradores" value={stats.admins} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
        <StatCard label="Activos" value={stats.ativos} tone="text-emerald-600" />
        <StatCard label="Inactivos" value={stats.inativos} tone="text-muted-foreground" />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email ou cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={roleFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("all")}
            >
              Todos
            </Button>
            {ROLE_OPTIONS.map((r) => (
              <Button
                key={r.value}
                variant={roleFilter === r.value ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Cargo / Turno</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Último acesso</TableHead>
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
                      <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      Nenhum utilizador encontrado
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                          {(u.profile?.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.profile?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{u.profile?.position || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.profile?.shift || ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Sem papel</span>}
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_STYLES[r as Role]}`}
                          >
                            {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true, locale: pt })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={u.profile?.is_active === false ? "secondary" : "default"}>
                        {u.profile?.is_active === false ? "Inactivo" : "Activo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Redefinir senha"
                          onClick={() => { setResetFor(u); setNewPass(""); }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remover"
                          disabled={u.id === meId}
                          onClick={() => setConfirmDelete(u)}
                        >
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Utilizador" : "Novo Utilizador"}</DialogTitle>
            <DialogDescription>
              {editing ? "Actualize dados, papéis e estado." : "Crie uma nova conta e atribua papéis."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nome completo *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Ex: Ana Silva"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="ana@aldeiamesa.co.mz"
                />
              </div>
            </div>

            {!editing && (
              <div className="grid gap-2">
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+258 84 000 0000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cargo</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="Ex: Chefe de Sala"
                />
              </div>
              <div className="grid gap-2">
                <Label>Turno</Label>
                <Input
                  value={form.shift}
                  onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                  placeholder="Manhã / Tarde / Noite"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Papéis / Permissões *</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {ROLE_OPTIONS.map((r) => {
                  const checked = form.roles.includes(r.value);
                  const editingAdmin = !!editing && editing.roles.includes("admin");
                  const adminLocked =
                    r.value === "admin" && (editingAdmin || stats.admins > 0);
                  return (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                        adminLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      } ${checked ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={adminLocked}
                        onCheckedChange={() => !adminLocked && toggleRole(r.value)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${ROLE_STYLES[r.value]}`} />
                          <span className="text-sm font-medium">{r.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {adminLocked
                            ? "Administrador único — papel bloqueado pelo sistema."
                            : r.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Utilizador activo</Label>
                  <p className="text-xs text-muted-foreground">
                    {editing.roles.includes("admin")
                      ? "O Administrador único permanece sempre activo."
                      : "Utilizadores inactivos permanecem no sistema mas não podem operar."}
                  </p>
                </div>
                <Switch
                  checked={editing.roles.includes("admin") ? true : form.is_active}
                  disabled={editing.roles.includes("admin")}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "A guardar..." : editing ? "Actualizar" : "Criar Utilizador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{resetFor?.profile?.full_name || resetFor?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetFor(null)}>Cancelar</Button>
            <Button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "A guardar..." : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover utilizador?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta de <strong>{confirmDelete?.profile?.full_name || confirmDelete?.email}</strong> será
              permanentemente removida. Esta acção não pode ser desfeita.
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

function StatCard({
  label, value, icon, tone,
}: { label: string; value: number; icon?: React.ReactNode; tone?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
