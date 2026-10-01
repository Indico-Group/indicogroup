CREATE TYPE public.fatura_status AS ENUM ('rascunho','emitida','parcial','paga','vencida','cancelada');
CREATE TYPE public.cotacao_status AS ENUM ('rascunho','enviada','aceite','recusada','expirada','convertida','cancelada');

-- Permissões por acção
CREATE OR REPLACE FUNCTION public.doc_pode(_acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (
      CASE _acao
        WHEN 'cancelar' THEN ARRAY['admin','gerente']
        WHEN 'converter' THEN ARRAY['admin','gerente','supervisor']
        ELSE ARRAY['admin','gerente','supervisor','caixa']
      END)
  )
$$;
GRANT EXECUTE ON FUNCTION public.doc_pode(text) TO authenticated;

-- Séries
CREATE TABLE public.documento_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  serie text NOT NULL DEFAULT 'GERAL',
  ano integer NOT NULL,
  prefixo text NOT NULL,
  ultimo integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, serie, ano)
);
GRANT SELECT ON public.documento_series TO authenticated;
GRANT ALL ON public.documento_series TO service_role;
ALTER TABLE public.documento_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY series_select ON public.documento_series FOR SELECT TO authenticated USING (public.doc_pode('ver'));

CREATE OR REPLACE FUNCTION public.proximo_numero_documento(_tipo text, _serie text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ano int := extract(year from now())::int; v_pref text; v_n int;
BEGIN
  v_pref := CASE _tipo WHEN 'fatura' THEN 'FT' WHEN 'cotacao' THEN 'COT' ELSE upper(_tipo) END;
  INSERT INTO public.documento_series (tipo, serie, ano, prefixo, ultimo)
  VALUES (_tipo, COALESCE(_serie,'GERAL'), v_ano, v_pref, 1)
  ON CONFLICT (tipo, serie, ano) DO UPDATE SET ultimo = documento_series.ultimo + 1
  RETURNING ultimo, prefixo INTO v_n, v_pref;
  RETURN v_pref || CASE WHEN COALESCE(_serie,'GERAL') <> 'GERAL' THEN '-' || _serie ELSE '' END
    || '-' || v_ano || '-' || lpad(v_n::text, 6, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.proximo_numero_documento(text,text) FROM PUBLIC, anon, authenticated;

-- Faturas
CREATE TABLE public.faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  serie text NOT NULL DEFAULT 'GERAL',
  status public.fatura_status NOT NULL DEFAULT 'rascunho',
  data_emissao date NOT NULL DEFAULT current_date,
  data_vencimento date,
  cliente_id uuid REFERENCES public.clientes(id),
  cliente_nome text,
  cliente_nuit text,
  cliente_telefone text,
  cliente_email text,
  cliente_endereco text,
  vendedor_id uuid,
  vendedor_nome text,
  estabelecimento text,
  metodo_pagamento public.pagamento_metodo,
  observacoes text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_desconto numeric NOT NULL DEFAULT 0,
  total_imposto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  cotacao_id uuid,
  venda_id uuid REFERENCES public.vendas(id),
  user_id uuid DEFAULT auth.uid(),
  emitida_em timestamptz,
  cancelada_em timestamptz,
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.faturas TO authenticated;
GRANT ALL ON public.faturas TO service_role;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY faturas_select ON public.faturas FOR SELECT TO authenticated USING (public.doc_pode('ver'));
CREATE POLICY faturas_insert ON public.faturas FOR INSERT TO authenticated WITH CHECK (public.doc_pode('criar'));
CREATE POLICY faturas_update ON public.faturas FOR UPDATE TO authenticated USING (public.doc_pode('editar')) WITH CHECK (public.doc_pode('editar'));

CREATE TABLE public.fatura_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id uuid NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  codigo text,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  unidade text,
  preco_unitario numeric NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  desconto numeric NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  imposto_percent numeric NOT NULL DEFAULT 0 CHECK (imposto_percent >= 0),
  subtotal numeric NOT NULL DEFAULT 0,
  valor_imposto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatura_itens TO authenticated;
GRANT ALL ON public.fatura_itens TO service_role;
ALTER TABLE public.fatura_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY fitens_select ON public.fatura_itens FOR SELECT TO authenticated USING (public.doc_pode('ver'));
CREATE POLICY fitens_write ON public.fatura_itens FOR ALL TO authenticated USING (public.doc_pode('editar')) WITH CHECK (public.doc_pode('editar'));

CREATE TABLE public.fatura_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id uuid NOT NULL REFERENCES public.faturas(id),
  valor numeric NOT NULL CHECK (valor > 0),
  metodo public.pagamento_metodo NOT NULL DEFAULT 'dinheiro',
  referencia text,
  data date NOT NULL DEFAULT current_date,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id),
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fatura_pagamentos TO authenticated;
GRANT ALL ON public.fatura_pagamentos TO service_role;
ALTER TABLE public.fatura_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpag_select ON public.fatura_pagamentos FOR SELECT TO authenticated USING (public.doc_pode('ver'));
CREATE POLICY fpag_insert ON public.fatura_pagamentos FOR INSERT TO authenticated WITH CHECK (public.doc_pode('editar'));

-- Cotações
CREATE TABLE public.cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  serie text NOT NULL DEFAULT 'GERAL',
  status public.cotacao_status NOT NULL DEFAULT 'rascunho',
  data date NOT NULL DEFAULT current_date,
  validade date,
  cliente_id uuid REFERENCES public.clientes(id),
  cliente_nome text,
  cliente_nuit text,
  cliente_telefone text,
  cliente_email text,
  cliente_endereco text,
  vendedor_id uuid,
  vendedor_nome text,
  estabelecimento text,
  observacoes text,
  condicoes text,
  prazo_entrega text,
  forma_pagamento text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_desconto numeric NOT NULL DEFAULT 0,
  total_imposto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  fatura_id uuid REFERENCES public.faturas(id),
  venda_id uuid REFERENCES public.vendas(id),
  convertida_em timestamptz,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faturas ADD CONSTRAINT faturas_cotacao_fk FOREIGN KEY (cotacao_id) REFERENCES public.cotacoes(id);
GRANT SELECT, INSERT, UPDATE ON public.cotacoes TO authenticated;
GRANT ALL ON public.cotacoes TO service_role;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cot_select ON public.cotacoes FOR SELECT TO authenticated USING (public.doc_pode('ver'));
CREATE POLICY cot_insert ON public.cotacoes FOR INSERT TO authenticated WITH CHECK (public.doc_pode('criar'));
CREATE POLICY cot_update ON public.cotacoes FOR UPDATE TO authenticated USING (public.doc_pode('editar')) WITH CHECK (public.doc_pode('editar'));

CREATE TABLE public.cotacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  codigo text,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  unidade text,
  preco_unitario numeric NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  desconto numeric NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  imposto_percent numeric NOT NULL DEFAULT 0 CHECK (imposto_percent >= 0),
  subtotal numeric NOT NULL DEFAULT 0,
  valor_imposto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacao_itens TO authenticated;
GRANT ALL ON public.cotacao_itens TO service_role;
ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY citens_select ON public.cotacao_itens FOR SELECT TO authenticated USING (public.doc_pode('ver'));
CREATE POLICY citens_write ON public.cotacao_itens FOR ALL TO authenticated USING (public.doc_pode('editar')) WITH CHECK (public.doc_pode('editar'));

CREATE INDEX ON public.faturas (data_emissao);
CREATE INDEX ON public.faturas (status);
CREATE INDEX ON public.cotacoes (data);
CREATE INDEX ON public.fatura_itens (fatura_id);
CREATE INDEX ON public.cotacao_itens (cotacao_id);
CREATE INDEX ON public.fatura_pagamentos (fatura_id);

-- Numeração e protecção do cabeçalho
CREATE OR REPLACE FUNCTION public.doc_cabecalho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text := CASE TG_TABLE_NAME WHEN 'faturas' THEN 'fatura' ELSE 'cotacao' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.numero := public.proximo_numero_documento(v_tipo, NEW.serie);
    NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
    RETURN NEW;
  END IF;
  IF NEW.numero IS DISTINCT FROM OLD.numero OR NEW.serie IS DISTINCT FROM OLD.serie THEN
    RAISE EXCEPTION 'O número do documento não pode ser alterado';
  END IF;
  IF NEW.status::text = 'cancelada' AND OLD.status::text <> 'cancelada' THEN
    IF auth.uid() IS NOT NULL AND NOT public.doc_pode('cancelar') THEN
      RAISE EXCEPTION 'Sem permissão para cancelar documentos';
    END IF;
  END IF;
  IF OLD.status::text IN ('cancelada','convertida','paga') AND NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('app.doc_interno', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Documento % não pode mudar de estado', OLD.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_faturas_cab BEFORE INSERT OR UPDATE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.doc_cabecalho();
CREATE TRIGGER trg_cotacoes_cab BEFORE INSERT OR UPDATE ON public.cotacoes FOR EACH ROW EXECUTE FUNCTION public.doc_cabecalho();

-- Cálculo das linhas e bloqueio após rascunho
CREATE OR REPLACE FUNCTION public.doc_item_calc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_base numeric;
BEGIN
  IF TG_TABLE_NAME = 'fatura_itens' THEN
    SELECT status::text INTO v_status FROM public.faturas WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id);
  ELSE
    SELECT status::text INTO v_status FROM public.cotacoes WHERE id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('rascunho','enviada') AND current_setting('app.doc_interno', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Só documentos em rascunho podem ter itens alterados';
  END IF;
  IF TG_TABLE_NAME = 'fatura_itens' AND v_status = 'enviada' THEN NULL; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.subtotal := round(NEW.quantidade * NEW.preco_unitario, 2);
  IF NEW.desconto > NEW.subtotal THEN NEW.desconto := NEW.subtotal; END IF;
  v_base := NEW.subtotal - NEW.desconto;
  NEW.valor_imposto := round(v_base * NEW.imposto_percent / 100, 2);
  NEW.total := v_base + NEW.valor_imposto;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fitens_calc BEFORE INSERT OR UPDATE OR DELETE ON public.fatura_itens FOR EACH ROW EXECUTE FUNCTION public.doc_item_calc();
CREATE TRIGGER trg_citens_calc BEFORE INSERT OR UPDATE OR DELETE ON public.cotacao_itens FOR EACH ROW EXECUTE FUNCTION public.doc_item_calc();

CREATE OR REPLACE FUNCTION public.doc_totais()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'fatura_itens' THEN
    UPDATE public.faturas f SET
      subtotal = COALESCE(s.sub,0), total_desconto = COALESCE(s.des,0), total_imposto = COALESCE(s.imp,0), total = COALESCE(s.tot,0)
    FROM (SELECT sum(subtotal) sub, sum(desconto) des, sum(valor_imposto) imp, sum(total) tot FROM public.fatura_itens WHERE fatura_id = COALESCE(NEW.fatura_id, OLD.fatura_id)) s
    WHERE f.id = COALESCE(NEW.fatura_id, OLD.fatura_id);
  ELSE
    UPDATE public.cotacoes c SET
      subtotal = COALESCE(s.sub,0), total_desconto = COALESCE(s.des,0), total_imposto = COALESCE(s.imp,0), total = COALESCE(s.tot,0)
    FROM (SELECT sum(subtotal) sub, sum(desconto) des, sum(valor_imposto) imp, sum(total) tot FROM public.cotacao_itens WHERE cotacao_id = COALESCE(NEW.cotacao_id, OLD.cotacao_id)) s
    WHERE c.id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_fitens_tot AFTER INSERT OR UPDATE OR DELETE ON public.fatura_itens FOR EACH ROW EXECUTE FUNCTION public.doc_totais();
CREATE TRIGGER trg_citens_tot AFTER INSERT OR UPDATE OR DELETE ON public.cotacao_itens FOR EACH ROW EXECUTE FUNCTION public.doc_totais();

-- Pagamentos de faturas → saldo, estado e Financeiro
CREATE OR REPLACE FUNCTION public.processar_pagamento_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.faturas%ROWTYPE; v_pago numeric; v_cat uuid; v_lanc uuid;
BEGIN
  SELECT * INTO f FROM public.faturas WHERE id = NEW.fatura_id FOR UPDATE;
  IF f.status::text NOT IN ('emitida','parcial','vencida') THEN
    RAISE EXCEPTION 'Só faturas emitidas podem receber pagamentos';
  END IF;
  IF NEW.valor > round(f.total - f.valor_pago, 2) + 0.009 THEN
    RAISE EXCEPTION 'Valor superior ao saldo em dívida';
  END IF;
  SELECT id INTO v_cat FROM public.financeiro_categorias WHERE tipo = 'receita' AND is_active ORDER BY (nome ILIKE '%venda%') DESC LIMIT 1;
  INSERT INTO public.financeiro_lancamentos (descricao, tipo, status, valor, vencimento, pago_em, metodo, categoria_id, cliente_id, documento, user_id)
  VALUES ('Pagamento fatura ' || f.numero, 'receita', 'pago', NEW.valor, NEW.data, now(), NEW.metodo, v_cat, f.cliente_id, f.numero, auth.uid())
  RETURNING id INTO v_lanc;
  NEW.lancamento_id := v_lanc;
  v_pago := f.valor_pago + NEW.valor;
  PERFORM set_config('app.doc_interno', '1', true);
  UPDATE public.faturas SET valor_pago = v_pago,
    metodo_pagamento = COALESCE(metodo_pagamento, NEW.metodo),
    status = CASE WHEN v_pago >= total - 0.009 THEN 'paga'::fatura_status ELSE 'parcial'::fatura_status END
  WHERE id = f.id;
  PERFORM set_config('app.doc_interno', '0', true);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fpag BEFORE INSERT ON public.fatura_pagamentos FOR EACH ROW EXECUTE FUNCTION public.processar_pagamento_fatura();

-- Emitir fatura (baixa de stock quando não vem de uma venda)
CREATE OR REPLACE FUNCTION public.emitir_fatura(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.faturas%ROWTYPE; it record;
BEGIN
  IF NOT public.doc_pode('editar') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO f FROM public.faturas WHERE id = p_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Fatura não encontrada'; END IF;
  IF f.status <> 'rascunho' THEN RAISE EXCEPTION 'Só rascunhos podem ser emitidos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_id) THEN RAISE EXCEPTION 'A fatura não tem itens'; END IF;
  IF COALESCE(trim(f.cliente_nome),'') = '' THEN RAISE EXCEPTION 'Indique o cliente'; END IF;
  IF f.venda_id IS NULL THEN
    FOR it IN SELECT produto_id, quantidade FROM public.fatura_itens WHERE fatura_id = p_id AND produto_id IS NOT NULL LOOP
      INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
      VALUES (it.produto_id, 'venda', it.quantidade, 0, 0, 'Fatura ' || f.numero, f.id::text, auth.uid());
    END LOOP;
  END IF;
  UPDATE public.faturas SET status = 'emitida', emitida_em = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_fatura(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.faturas%ROWTYPE; it record;
BEGIN
  IF NOT public.doc_pode('cancelar') THEN RAISE EXCEPTION 'Sem permissão para cancelar'; END IF;
  SELECT * INTO f FROM public.faturas WHERE id = p_id FOR UPDATE;
  IF f.status = 'cancelada' THEN RAISE EXCEPTION 'Fatura já cancelada'; END IF;
  IF f.valor_pago > 0 THEN RAISE EXCEPTION 'Fatura com pagamentos registados não pode ser cancelada'; END IF;
  IF f.status <> 'rascunho' AND f.venda_id IS NULL THEN
    FOR it IN SELECT produto_id, quantidade FROM public.fatura_itens WHERE fatura_id = p_id AND produto_id IS NOT NULL LOOP
      INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
      VALUES (it.produto_id, 'ajuste', it.quantidade, 0, 0, 'Estorno fatura ' || f.numero, f.id::text, auth.uid());
    END LOOP;
  END IF;
  UPDATE public.faturas SET status = 'cancelada', cancelada_em = now(), motivo_cancelamento = p_motivo WHERE id = p_id;
END $$;

-- Conversão de cotação
CREATE OR REPLACE FUNCTION public.converter_cotacao(p_id uuid, p_destino text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cotacoes%ROWTYPE; v_new uuid; v_desc numeric;
BEGIN
  IF NOT public.doc_pode('converter') THEN RAISE EXCEPTION 'Sem permissão para converter cotações'; END IF;
  SELECT * INTO c FROM public.cotacoes WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status <> 'aceite' THEN RAISE EXCEPTION 'Só cotações aceites podem ser convertidas'; END IF;

  IF p_destino = 'fatura' THEN
    INSERT INTO public.faturas (cliente_id, cliente_nome, cliente_nuit, cliente_telefone, cliente_email, cliente_endereco,
      vendedor_id, vendedor_nome, estabelecimento, observacoes, cotacao_id, data_vencimento)
    VALUES (c.cliente_id, c.cliente_nome, c.cliente_nuit, c.cliente_telefone, c.cliente_email, c.cliente_endereco,
      c.vendedor_id, c.vendedor_nome, c.estabelecimento, c.observacoes, c.id, current_date + 30)
    RETURNING id INTO v_new;
    INSERT INTO public.fatura_itens (fatura_id, produto_id, codigo, descricao, quantidade, unidade, preco_unitario, desconto, imposto_percent, ordem)
    SELECT v_new, produto_id, codigo, descricao, quantidade, unidade, preco_unitario, desconto, imposto_percent, ordem
    FROM public.cotacao_itens WHERE cotacao_id = p_id ORDER BY ordem;
    PERFORM set_config('app.doc_interno', '1', true);
    UPDATE public.cotacoes SET status = 'convertida', fatura_id = v_new, convertida_em = now() WHERE id = p_id;
    PERFORM set_config('app.doc_interno', '0', true);
  ELSIF p_destino = 'venda' THEN
    IF EXISTS (SELECT 1 FROM public.cotacao_itens WHERE cotacao_id = p_id AND produto_id IS NULL) THEN
      RAISE EXCEPTION 'A cotação tem serviços sem produto associado; converta em fatura';
    END IF;
    SELECT COALESCE(sum(desconto),0) INTO v_desc FROM public.cotacao_itens WHERE cotacao_id = p_id;
    INSERT INTO public.vendas (cliente_id, tipo, subtotal, desconto, acrescimo, total, status, observacoes, user_id)
    VALUES (c.cliente_id, 'balcao', c.subtotal, v_desc, c.total_imposto, c.total, 'aberta',
      'Cotação ' || c.numero || COALESCE(' — ' || c.cliente_nome, ''), auth.uid())
    RETURNING id INTO v_new;
    INSERT INTO public.venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_unitario, desconto, subtotal)
    SELECT v_new, produto_id, descricao, quantidade, preco_unitario, desconto, total
    FROM public.cotacao_itens WHERE cotacao_id = p_id;
    PERFORM set_config('app.doc_interno', '1', true);
    UPDATE public.cotacoes SET status = 'convertida', venda_id = v_new, convertida_em = now() WHERE id = p_id;
    PERFORM set_config('app.doc_interno', '0', true);
  ELSE
    RAISE EXCEPTION 'Destino inválido';
  END IF;
  RETURN v_new;
END $$;

REVOKE EXECUTE ON FUNCTION public.doc_cabecalho(), public.doc_item_calc(), public.doc_totais(), public.processar_pagamento_fatura() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emitir_fatura(uuid), public.cancelar_fatura(uuid,text), public.converter_cotacao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_fatura(uuid), public.cancelar_fatura(uuid,text), public.converter_cotacao(uuid,text) TO authenticated;