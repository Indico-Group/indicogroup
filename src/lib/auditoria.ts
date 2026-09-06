import { supabase } from "@/integrations/supabase/client";

export type AuditoriaEvento = {
  modulo: string;
  acao: string;
  entidade?: string | null;
  entidade_id?: string | null;
  descricao?: string | null;
  detalhes?: Record<string, unknown> | null;
};

/** Regista um evento no histórico de auditoria (nunca quebra o fluxo do utilizador). */
export async function registarAuditoria(evento: AuditoriaEvento) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    let nome = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null;
    if (user?.id) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (perfil?.full_name) nome = perfil.full_name;
    }
    await supabase.from("auditoria").insert({
      user_id: user?.id ?? null,
      user_nome: nome,
      modulo: evento.modulo,
      acao: evento.acao,
      entidade: evento.entidade ?? null,
      entidade_id: evento.entidade_id ?? null,
      descricao: evento.descricao ?? null,
      detalhes: (evento.detalhes ?? null) as never,
    });
  } catch {
    // Auditoria é acessória — falhas silenciosas.
  }
}

/** Descarrega dados como ficheiro CSV (compatível com Excel). */
export function exportarCsv(nomeBase: string, colunas: string[], linhas: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [colunas, ...linhas].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeBase.replace(/[^\w-]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
