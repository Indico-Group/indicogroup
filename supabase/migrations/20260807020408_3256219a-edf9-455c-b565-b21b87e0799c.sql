CREATE TYPE public.compra_status AS ENUM ('rascunho','pendente','recebida','cancelada');

CREATE SEQUENCE IF NOT EXISTS public.compras_numero_seq;

CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.compras_numero_seq'),
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  status public.compra_status NOT NULL DEFAULT 'rascunho',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  documento text,
  data_prevista date,
  observacoes text,
  user_id uuid,
  recebida_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.compras_numero_seq TO authenticated, service_role;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_select" ON public.compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "compras_insert" ON public.compras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "compras_update" ON public.compras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "compras_delete" ON public.compras FOR DELETE TO authenticated USING (true);

CREATE TABLE public.compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  nome_produto text NOT NULL,
  quantidade numeric(12,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compra_itens TO authenticated;
GRANT ALL ON public.compra_itens TO service_role;
ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compra_itens_select" ON public.compra_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "compra_itens_insert" ON public.compra_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "compra_itens_update" ON public.compra_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "compra_itens_delete" ON public.compra_itens FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_compras_updated_at BEFORE UPDATE ON public.compras
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.processar_compra_recebida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'recebida' AND (OLD.status IS DISTINCT FROM 'recebida') THEN
    IF NEW.recebida_em IS NULL THEN
      NEW.recebida_em := now();
    END IF;
    FOR item IN SELECT produto_id, quantidade, preco_unitario FROM public.compra_itens WHERE compra_id = NEW.id LOOP
      INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
      VALUES (item.produto_id, 'compra', item.quantidade, 0, 0, 'Compra #' || NEW.numero, NEW.id::text, COALESCE(NEW.user_id, auth.uid()));

      UPDATE public.produtos SET preco_compra = item.preco_unitario
      WHERE id = item.produto_id AND item.preco_unitario > 0;
    END LOOP;
  END IF;

  IF NEW.status = 'cancelada' AND (OLD.status IS DISTINCT FROM 'cancelada') THEN
    IF NEW.cancelada_em IS NULL THEN
      NEW.cancelada_em := now();
    END IF;
    IF OLD.status = 'recebida' THEN
      FOR item IN SELECT produto_id, quantidade FROM public.compra_itens WHERE compra_id = NEW.id LOOP
        INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
        VALUES (item.produto_id, 'ajuste', -item.quantidade, 0, 0, 'Estorno compra #' || NEW.numero, NEW.id::text, COALESCE(NEW.user_id, auth.uid()));
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compras_status BEFORE UPDATE ON public.compras
FOR EACH ROW EXECUTE FUNCTION public.processar_compra_recebida();