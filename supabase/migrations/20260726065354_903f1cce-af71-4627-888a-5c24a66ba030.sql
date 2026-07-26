
-- ========== ENUMS ==========
CREATE TYPE public.venda_tipo AS ENUM ('balcao','mesa','delivery');
CREATE TYPE public.venda_status AS ENUM ('aberta','paga','cancelada');
CREATE TYPE public.pagamento_metodo AS ENUM ('dinheiro','mpesa','emola','pos','transferencia','misto');

-- ========== CLIENTES ==========
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  nif text,
  morada text,
  aniversario date,
  notas text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== SEQUENCIA NUMERO VENDA ==========
CREATE SEQUENCE public.vendas_numero_seq START 1;

-- ========== VENDAS ==========
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('public.vendas_numero_seq'),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo public.venda_tipo NOT NULL DEFAULT 'balcao',
  mesa text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  acrescimo numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status public.venda_status NOT NULL DEFAULT 'aberta',
  metodo_pagamento public.pagamento_metodo,
  observacoes text,
  user_id uuid,
  paga_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendas_select ON public.vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY vendas_insert ON public.vendas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vendas_update ON public.vendas FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY vendas_delete ON public.vendas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER trg_vendas_updated_at BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== VENDA ITENS ==========
CREATE TABLE public.venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  nome_produto text NOT NULL,
  quantidade numeric(12,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_itens TO authenticated;
GRANT ALL ON public.venda_itens TO service_role;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY venda_itens_select ON public.venda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY venda_itens_insert ON public.venda_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY venda_itens_update ON public.venda_itens FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY venda_itens_delete ON public.venda_itens FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ========== VENDA PAGAMENTOS ==========
CREATE TABLE public.venda_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  metodo public.pagamento_metodo NOT NULL,
  valor numeric(12,2) NOT NULL,
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_pagamentos TO authenticated;
GRANT ALL ON public.venda_pagamentos TO service_role;
ALTER TABLE public.venda_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY venda_pag_select ON public.venda_pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY venda_pag_insert ON public.venda_pagamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY venda_pag_delete ON public.venda_pagamentos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ========== TRIGGER: Baixa de estoque ao pagar ==========
CREATE OR REPLACE FUNCTION public.processar_venda_paga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Somente quando muda para 'paga'
  IF NEW.status = 'paga' AND (OLD.status IS DISTINCT FROM 'paga') THEN
    IF NEW.paga_em IS NULL THEN
      NEW.paga_em := now();
    END IF;
    FOR item IN SELECT produto_id, quantidade FROM public.venda_itens WHERE venda_id = NEW.id LOOP
      INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
      VALUES (item.produto_id, 'venda', item.quantidade, 0, 0, 'Venda #' || NEW.numero, NEW.id::text, COALESCE(NEW.user_id, auth.uid()));
    END LOOP;
  END IF;

  IF NEW.status = 'cancelada' AND (OLD.status IS DISTINCT FROM 'cancelada') THEN
    IF NEW.cancelada_em IS NULL THEN
      NEW.cancelada_em := now();
    END IF;
    -- Estorno somente se estava paga
    IF OLD.status = 'paga' THEN
      FOR item IN SELECT produto_id, quantidade FROM public.venda_itens WHERE venda_id = NEW.id LOOP
        INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
        VALUES (item.produto_id, 'ajuste', item.quantidade, 0, 0, 'Estorno venda #' || NEW.numero, NEW.id::text, COALESCE(NEW.user_id, auth.uid()));
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendas_status
BEFORE UPDATE OF status ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.processar_venda_paga();

-- Também dispara ao inserir já como 'paga'
CREATE OR REPLACE FUNCTION public.processar_venda_paga_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'paga' THEN
    FOR item IN SELECT produto_id, quantidade FROM public.venda_itens WHERE venda_id = NEW.id LOOP
      INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
      VALUES (item.produto_id, 'venda', item.quantidade, 0, 0, 'Venda #' || NEW.numero, NEW.id::text, COALESCE(NEW.user_id, auth.uid()));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendas_after_insert
AFTER INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.processar_venda_paga_insert();

CREATE INDEX idx_vendas_status ON public.vendas(status);
CREATE INDEX idx_vendas_created_at ON public.vendas(created_at DESC);
CREATE INDEX idx_venda_itens_venda ON public.venda_itens(venda_id);
CREATE INDEX idx_venda_pag_venda ON public.venda_pagamentos(venda_id);
