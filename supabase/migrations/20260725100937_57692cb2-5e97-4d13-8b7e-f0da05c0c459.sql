
CREATE TYPE public.movimento_tipo AS ENUM ('compra','venda','ajuste','transferencia_entrada','transferencia_saida');

CREATE TABLE public.movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo public.movimento_tipo NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  estoque_anterior NUMERIC(12,3) NOT NULL,
  estoque_novo NUMERIC(12,3) NOT NULL,
  motivo TEXT,
  referencia TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.movimentos_estoque TO authenticated;
GRANT ALL ON public.movimentos_estoque TO service_role;
ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimentos_select" ON public.movimentos_estoque
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimentos_insert" ON public.movimentos_estoque
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_movimentos_produto ON public.movimentos_estoque(produto_id, created_at DESC);
CREATE INDEX idx_movimentos_created ON public.movimentos_estoque(created_at DESC);

-- Trigger: calcula estoque_anterior/novo e actualiza produto
CREATE OR REPLACE FUNCTION public.processar_movimento_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual NUMERIC(12,3);
  delta NUMERIC(12,3);
BEGIN
  SELECT estoque_atual INTO atual FROM public.produtos WHERE id = NEW.produto_id FOR UPDATE;
  IF atual IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF NEW.tipo IN ('compra','transferencia_entrada') THEN
    delta := ABS(NEW.quantidade);
  ELSIF NEW.tipo IN ('venda','transferencia_saida') THEN
    delta := -ABS(NEW.quantidade);
  ELSE -- ajuste: usa valor com sinal
    delta := NEW.quantidade;
  END IF;

  NEW.estoque_anterior := atual;
  NEW.estoque_novo := atual + delta;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  UPDATE public.produtos SET estoque_atual = NEW.estoque_novo WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_processar_movimento
  BEFORE INSERT ON public.movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION public.processar_movimento_estoque();

-- Bloquear updates e deletes (histórico imutável)
CREATE POLICY "movimentos_no_update" ON public.movimentos_estoque
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "movimentos_no_delete" ON public.movimentos_estoque
  FOR DELETE TO authenticated USING (false);
