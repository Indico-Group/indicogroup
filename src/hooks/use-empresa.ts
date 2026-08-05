import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type EmpresaConfig = {
  nome_empresa: string;
  nif: string | null;
  morada: string | null;
  telefone: string | null;
  email: string | null;
  moeda: string;
  logo_url: string | null;
  mensagem_recibo: string | null;
  rodape_recibo: string | null;
  prefixo_recibo: string | null;
  recibo_modelo: ReciboModelo | null;
  recibo_densidade: ReciboDensidade | null;
  recibo_margem_mm: number | null;
};

export type ReciboModelo = "termico" | "a4";
export type ReciboDensidade = "auto" | "compacta" | "normal" | "ampla";

export function isExternalUrl(v?: string | null) {
  return !!v && /^https?:\/\//i.test(v);
}

/** Resolve um logo guardado como caminho no bucket privado `branding` ou URL externa. */
export async function resolveLogoUrl(logo: string | null | undefined) {
  if (!logo) return null;
  if (isExternalUrl(logo)) return logo;
  const { data } = await supabase.storage.from("branding").createSignedUrl(logo, 3600);
  return data?.signedUrl ?? null;
}

export function useEmpresa() {
  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as EmpresaConfig | null;
    },
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-url", config?.logo_url],
    enabled: !!config?.logo_url,
    staleTime: 30 * 60_000,
    queryFn: () => resolveLogoUrl(config?.logo_url),
  });

  return { config: config ?? null, logoUrl: logoUrl ?? null };
}
