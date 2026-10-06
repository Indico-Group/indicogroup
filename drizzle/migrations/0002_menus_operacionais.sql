CREATE TABLE public.unidades_medida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sigla text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades_medida TO authenticated;
GRANT ALL ON public.unidades_medida TO service_role;
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;
CREATE POLICY um_select ON public.unidades_medida FOR SELECT TO authenticated USING (true);
CREATE POLICY um_write ON public.unidades_medida FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER um_updated BEFORE UPDATE ON public.unidades_medida FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  lugares integer NOT NULL DEFAULT 4,
  zona text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO authenticated;
GRANT ALL ON public.mesas TO service_role;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY mesas_select ON public.mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY mesas_write ON public.mesas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER mesas_updated BEFORE UPDATE ON public.mesas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.venda_itens
  ADD COLUMN estado_cozinha text NOT NULL DEFAULT 'entregue',
  ADD COLUMN observacao text,
  ADD COLUMN enviado_em timestamptz,
  ADD COLUMN pronto_em timestamptz;

CREATE TABLE public.devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id),
  venda_item_id uuid NOT NULL REFERENCES public.venda_itens(id),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  nome_produto text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL,
  repor_stock boolean NOT NULL DEFAULT true,
  metodo pagamento_metodo,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id),
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.devolucoes TO authenticated;
GRANT ALL ON public.devolucoes TO service_role;
ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_select ON public.devolucoes FOR SELECT TO authenticated USING (true);
CREATE POLICY dev_insert ON public.devolucoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'supervisor'));

CREATE OR REPLACE FUNCTION public.processar_devolucao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it RECORD; v RECORD; ja numeric; lanc uuid;
BEGIN
  SELECT * INTO it FROM venda_itens WHERE id = NEW.venda_item_id;
  IF it IS NULL OR it.venda_id <> NEW.venda_id THEN RAISE EXCEPTION 'Item não pertence à venda'; END IF;
  SELECT * INTO v FROM vendas WHERE id = NEW.venda_id;
  IF v.status <> 'paga' THEN RAISE EXCEPTION 'Só é possível devolver itens de vendas pagas'; END IF;
  SELECT COALESCE(SUM(quantidade),0) INTO ja FROM devolucoes WHERE venda_item_id = NEW.venda_item_id;
  IF ja + NEW.quantidade > it.quantidade THEN
    RAISE EXCEPTION 'Quantidade excede o vendido (vendido %, já devolvido %)', it.quantidade, ja;
  END IF;
  NEW.produto_id := it.produto_id;
  NEW.nome_produto := it.nome_produto;
  IF NEW.valor > (it.subtotal / NULLIF(it.quantidade,0)) * NEW.quantidade + 0.01 THEN
    RAISE EXCEPTION 'Valor reembolsado superior ao valor pago pelo item';
  END IF;
  IF NEW.repor_stock THEN
    INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
    VALUES (it.produto_id, 'ajuste', NEW.quantidade, 0, 0, 'Devolução venda #' || v.numero, v.id::text, auth.uid());
  END IF;
  IF NEW.valor > 0 THEN
    INSERT INTO financeiro_lancamentos (descricao, tipo, status, valor, vencimento, pago_em, metodo, documento, user_id)
    VALUES ('Reembolso devolução venda #' || v.numero, 'despesa', 'pago', NEW.valor, current_date, now(), NEW.metodo, 'DEV-' || v.numero, auth.uid())
    RETURNING id INTO lanc;
    NEW.lancamento_id := lanc;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER devolucao_proc BEFORE INSERT ON public.devolucoes FOR EACH ROW EXECUTE FUNCTION public.processar_devolucao();