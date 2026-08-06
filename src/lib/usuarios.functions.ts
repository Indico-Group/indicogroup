import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLES: AppRole[] = [
  "admin",
  "gerente",
  "supervisor",
  "caixa",
  "garcom",
  "cozinha",
  "estoque",
];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar esta acção");
}

/** O sistema tem um único administrador: o primeiro registado. */
async function assertAdminUnico(supabaseAdmin: any, targetId: string | null, roles: AppRole[]) {
  if (!roles.includes("admin")) return;
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  const existente = (data ?? []).map((r: any) => r.user_id);
  if (existente.length > 0 && (!targetId || !existente.includes(targetId))) {
    throw new Error("Só pode existir um Administrador no sistema");
  }
}

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);

    const ids = authList.users.map((u) => u.id);

    const [profilesRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const profileMap = new Map(profilesRes.data.map((p) => [p.id, p]));
    const rolesMap = new Map<string, AppRole[]>();
    for (const r of rolesRes.data) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesMap.set(r.user_id, arr);
    }

    return authList.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      profile: profileMap.get(u.id) ?? null,
      roles: rolesMap.get(u.id) ?? [],
    }));
  });

const createSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  position: z.string().trim().max(80).optional().nullable(),
  shift: z.string().trim().max(40).optional().nullable(),
  roles: z.array(z.enum(ROLES as [AppRole, ...AppRole[]])).min(1),
});

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdminUnico(supabaseAdmin, null, data.roles);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message || "Falha ao criar utilizador");

    const uid = created.user.id;

    // Trigger creates profile; update extra fields
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        position: data.position ?? null,
        shift: data.shift ?? null,
      })
      .eq("id", uid);
    if (pErr) throw new Error(pErr.message);

    // Reset roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: uid, role })));
    if (rErr) throw new Error(rErr.message);

    return { id: uid };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  position: z.string().trim().max(80).optional().nullable(),
  shift: z.string().trim().max(40).optional().nullable(),
  is_active: z.boolean(),
  roles: z.array(z.enum(ROLES as [AppRole, ...AppRole[]])).min(1),
});

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdminUnico(supabaseAdmin, data.id, data.roles);

    // O Administrador único é intocável: não pode ser rebaixado nem desactivado
    const { data: rolesActuais } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);
    const eraAdmin = (rolesActuais ?? []).some((r: any) => r.role === "admin");
    if (eraAdmin) {
      if (!data.roles.includes("admin")) {
        throw new Error("O Administrador único não pode ser rebaixado");
      }
      if (!data.is_active) {
        throw new Error("O Administrador único deve permanecer sempre activo");
      }
    }

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        position: data.position ?? null,
        shift: data.shift ?? null,
        is_active: eraAdmin ? true : data.is_active,
      })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: data.id, role })));
    if (rErr) throw new Error(rErr.message);

    return { ok: true };
  });


const resetSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(6).max(72),
});

export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) {
      throw new Error("Não pode remover a sua própria conta");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O Administrador único nunca pode ser apagado
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);
    if (roles?.some((r) => r.role === "admin")) {
      throw new Error("A conta de Administrador não pode ser removida");
    }


    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
