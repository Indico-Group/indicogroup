import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Palette, Printer, Bell, Save, Loader2, Sun, Moon, Monitor, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/use-permissions";
import { resolveLogoUrl, isExternalUrl } from "@/hooks/use-empresa";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Aldeia Mesa" },
      { name: "description", content: "Preferências do sistema, dados da empresa, aparência e recibos." },
    ],
  }),
  component: ConfiguracoesPage,
});

type Config = {
  id: number;
  nome_empresa: string;
  nif: string | null;
  morada: string | null;
  telefone: string | null;
  email: string | null;
  moeda: string;
  iva_percent: number;
  logo_url: string | null;
  mensagem_recibo: string | null;
  rodape_recibo: string | null;
  prefixo_recibo: string | null;
  tempo_sessao_min: number;
  notificacoes_estoque: boolean;
  notificacoes_caixa: boolean;
  tema: string;
};

const THEME_KEY = "aldeia.theme";

function applyTheme(t: string) {
  const root = document.documentElement;
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Config | null>(null);
  const { canDo } = usePermissions();
  const podeEditar = canDo("gerirConfiguracoes");

  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as Config;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) ?? "system";
    applyTheme(saved);
  }, []);

  const save = useMutation({
    mutationFn: async (payload: Config) => {
      const { error } = await supabase
        .from("configuracoes")
        .update({
          nome_empresa: payload.nome_empresa,
          nif: payload.nif,
          morada: payload.morada,
          telefone: payload.telefone,
          email: payload.email,
          moeda: payload.moeda,
          iva_percent: payload.iva_percent,
          logo_url: payload.logo_url,
          mensagem_recibo: payload.mensagem_recibo,
          rodape_recibo: payload.rodape_recibo,
          prefixo_recibo: payload.prefixo_recibo,
          tempo_sessao_min: payload.tempo_sessao_min,
          notificacoes_estoque: payload.notificacoes_estoque,
          notificacoes_caixa: payload.notificacoes_caixa,
          tema: payload.tema,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações guardadas");
      qc.invalidateQueries({ queryKey: ["configuracoes"] });
      qc.invalidateQueries({ queryKey: ["logo-url"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao guardar (verifique permissões)"),
  });

  const update = <K extends keyof Config>(k: K, v: Config[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const changeTheme = (t: string) => {
    update("tema", t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
  };

  if (isLoading || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências do sistema, dados da empresa e aparência"
        actions={
          <Button onClick={() => save.mutate(form)} disabled={save.isPending || !podeEditar}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar alterações
          </Button>
        }
      />

      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4">
          <TabsTrigger value="empresa"><Building2 className="mr-2 h-4 w-4" />Empresa</TabsTrigger>
          <TabsTrigger value="aparencia"><Palette className="mr-2 h-4 w-4" />Aparência</TabsTrigger>
          <TabsTrigger value="recibos"><Printer className="mr-2 h-4 w-4" />Recibos</TabsTrigger>
          <TabsTrigger value="sistema"><Bell className="mr-2 h-4 w-4" />Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Dados do estabelecimento</CardTitle>
              <CardDescription>Aparecem em recibos, relatórios e cabeçalhos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da empresa">
                <Input value={form.nome_empresa} onChange={(e) => update("nome_empresa", e.target.value)} />
              </Field>
              <Field label="NUIT / NIF">
                <Input value={form.nif ?? ""} onChange={(e) => update("nif", e.target.value)} />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone ?? ""} onChange={(e) => update("telefone", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Morada">
                  <Textarea rows={2} value={form.morada ?? ""} onChange={(e) => update("morada", e.target.value)} />
                </Field>
              </div>
              <Field label="Moeda">
                <Select value={form.moeda} onValueChange={(v) => update("moeda", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MZN">MZN — Metical</SelectItem>
                    <SelectItem value="USD">USD — Dólar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="ZAR">ZAR — Rand</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="IVA (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={form.iva_percent}
                  onChange={(e) => update("iva_percent", Number(e.target.value))}
                />
              </Field>
              <div className="md:col-span-2">
                <LogoUploader value={form.logo_url} onChange={(v) => update("logo_url", v)} />
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia">
          <Card>
            <CardHeader>
              <CardTitle>Tema da interface</CardTitle>
              <CardDescription>A preferência é aplicada imediatamente neste dispositivo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {[
                { v: "light", label: "Claro", Icon: Sun },
                { v: "dark", label: "Escuro", Icon: Moon },
                { v: "system", label: "Sistema", Icon: Monitor },
              ].map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeTheme(v)}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition hover:border-primary ${
                    form.tema === v ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {v === "system" ? "Seguir preferência do dispositivo" : `Modo ${label.toLowerCase()} fixo`}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recibos">
          <Card>
            <CardHeader>
              <CardTitle>Personalização de recibos</CardTitle>
              <CardDescription>Mensagens e prefixos usados nos comprovantes de venda.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Modelo do recibo">
                <Select
                  value={form.recibo_modelo ?? "termico"}
                  onValueChange={(v) => update("recibo_modelo", v as Config["recibo_modelo"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="termico">Térmico 80 mm</SelectItem>
                    <SelectItem value="a4">Folha A4</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Densidade de impressão">
                <Select
                  value={form.recibo_densidade ?? "auto"}
                  onValueChange={(v) => update("recibo_densidade", v as Config["recibo_densidade"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automática (adapta ao nº de itens)</SelectItem>
                    <SelectItem value="compacta">Compacta</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="ampla">Ampla</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Margem (mm) — vazio = automática">
                <Input
                  type="number"
                  min={2}
                  max={40}
                  placeholder="Automática"
                  value={form.recibo_margem_mm ?? ""}
                  onChange={(e) =>
                    update("recibo_margem_mm", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Prefixo do recibo">
                <Input value={form.prefixo_recibo ?? ""} onChange={(e) => update("prefixo_recibo", e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Mensagem no topo">
                  <Textarea
                    rows={2}
                    value={form.mensagem_recibo ?? ""}
                    onChange={(e) => update("mensagem_recibo", e.target.value)}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Rodapé (endereço, contactos, disclaimer)">
                  <Textarea
                    rows={3}
                    value={form.rodape_recibo ?? ""}
                    onChange={(e) => update("rodape_recibo", e.target.value)}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                O logotipo e os dados da empresa (aba Empresa) aparecem sempre no topo do recibo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema">
          <Card>
            <CardHeader>
              <CardTitle>Sessão e notificações</CardTitle>
              <CardDescription>Controle de tempo de sessão e alertas do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Field label="Tempo de sessão (minutos)">
                <Input
                  type="number"
                  min={5}
                  value={form.tempo_sessao_min}
                  onChange={(e) => update("tempo_sessao_min", Number(e.target.value))}
                  className="max-w-xs"
                />
              </Field>
              <Separator />
              <ToggleRow
                label="Alertas de estoque baixo"
                description="Notificar quando produtos atingirem o estoque mínimo."
                checked={form.notificacoes_estoque}
                onChange={(v) => update("notificacoes_estoque", v)}
              />
              <ToggleRow
                label="Alertas de caixa"
                description="Avisar sobre aberturas, sangrias e diferenças de fecho."
                checked={form.notificacoes_caixa}
                onChange={(v) => update("notificacoes_caixa", v)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LogoUploader({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setPreview(null);
      return;
    }
    resolveLogoUrl(value).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um ficheiro de imagem (PNG, JPG ou SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O logotipo não pode exceder 2 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      onChange(path);
      toast.success("Logotipo carregado — guarde as alterações para aplicar");
    } catch (e) {
      toast.error((e as Error).message || "Falha no upload do logotipo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Logotipo da empresa</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {preview ? (
            <img src={preview} alt="Pré-visualização do logotipo" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {uploading ? "A carregar..." : "Carregar logotipo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
            {value && (
              <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                <Trash2 className="mr-2 h-4 w-4" />Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG ou SVG até 2 MB. Aplicado no menu lateral, cabeçalho e recibos.
          </p>
          <Input
            value={isExternalUrl(value) ? (value as string) : ""}
            onChange={(e) => onChange(e.target.value.trim() || null)}
            placeholder="Ou cole um URL https://..."
            className="max-w-sm"
          />
        </div>
      </div>
    </div>
  );
}
