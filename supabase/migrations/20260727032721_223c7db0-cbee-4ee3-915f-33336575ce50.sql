
CREATE TYPE public.caixa_status AS ENUM ('aberta','fechada');
CREATE TYPE public.caixa_movimento_tipo AS ENUM ('entrada','saida','sangria','reforco');

CREATE TABLE public.caixa_sessoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  valor_abertura NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_fechamento NUMERIC(12,2),
  valor_esperado NUMERIC(12,2),
  diferenca NUMERIC(12,2),
  status caixa_status NOT NULL DEFAULT 'aberta',
  observacoes_abertura TEXT,
  observacoes_fechamento TEXT,
  aberta_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_sessoes TO authenticated;
GRANT ALL ON public.caixa_sessoes TO service_role;
ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY caixa_sessoes_select ON public.caixa_sessoes FOR SELECT TO authenticated USING (true);
CREATE POLICY caixa_sessoes_insert ON public.caixa_sessoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY caixa_sessoes_update ON public.caixa_sessoes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY caixa_sessoes_delete ON public.caixa_sessoes FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE TRIGGER trg_caixa_sessoes_updated_at BEFORE UPDATE ON public.caixa_sessoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.caixa_movimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id UUID NOT NULL REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE,
  user_id UUID,
  tipo caixa_movimento_tipo NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  motivo TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_movimentos TO authenticated;
GRANT ALL ON public.caixa_movimentos TO service_role;
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY caixa_mov_select ON public.caixa_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY caixa_mov_insert ON public.caixa_movimentos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY caixa_mov_delete ON public.caixa_movimentos FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

CREATE INDEX idx_caixa_sessoes_status ON public.caixa_sessoes(status);
CREATE INDEX idx_caixa_movimentos_sessao ON public.caixa_movimentos(sessao_id);
