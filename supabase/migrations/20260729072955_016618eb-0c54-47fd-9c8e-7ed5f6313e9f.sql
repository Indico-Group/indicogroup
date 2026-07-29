CREATE TABLE public.configuracoes (
  id INT PRIMARY KEY DEFAULT 1,
  nome_empresa TEXT NOT NULL DEFAULT 'Aldeia Mesa',
  nif TEXT,
  morada TEXT,
  telefone TEXT,
  email TEXT,
  moeda TEXT NOT NULL DEFAULT 'MZN',
  iva_percent NUMERIC(5,2) NOT NULL DEFAULT 17,
  logo_url TEXT,
  mensagem_recibo TEXT DEFAULT 'Obrigado pela preferência!',
  rodape_recibo TEXT,
  prefixo_recibo TEXT DEFAULT 'AM',
  tempo_sessao_min INT NOT NULL DEFAULT 60,
  notificacoes_estoque BOOLEAN NOT NULL DEFAULT true,
  notificacoes_caixa BOOLEAN NOT NULL DEFAULT true,
  tema TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT configuracoes_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_select" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_insert" ON public.configuracoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "config_update" ON public.configuracoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE TRIGGER configuracoes_set_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;