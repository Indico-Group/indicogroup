CREATE TYPE public.quarto_estado AS ENUM ('livre','reservado','ocupado','limpeza','manutencao');
CREATE TYPE public.reserva_estado AS ENUM ('reservada','checkin','checkout','cancelada');

CREATE OR REPLACE FUNCTION public.hosp_pode() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','gerente','supervisor','caixa'))
$$;
GRANT EXECUTE ON FUNCTION public.hosp_pode() TO authenticated;

CREATE TABLE public.quarto_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, capacidade int NOT NULL DEFAULT 1, preco numeric(12,2) NOT NULL DEFAULT 0,
  descricao text, comodidades text, imagem_url text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.quartos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE, tipo_id uuid REFERENCES public.quarto_tipos(id),
  estado public.quarto_estado NOT NULL DEFAULT 'livre', preco numeric(12,2), observacoes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.hospedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, documento text, telefone text, email text, endereco text, observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospede_id uuid NOT NULL REFERENCES public.hospedes(id),
  quarto_id uuid NOT NULL REFERENCES public.quartos(id),
  checkin date NOT NULL, checkout date NOT NULL, num_hospedes int NOT NULL DEFAULT 1,
  preco_noite numeric(12,2) NOT NULL DEFAULT 0, noites int NOT NULL DEFAULT 0,
  valor_estadia numeric(12,2) NOT NULL DEFAULT 0, desconto numeric(12,2) NOT NULL DEFAULT 0,
  total_consumos numeric(12,2) NOT NULL DEFAULT 0, total numeric(12,2) NOT NULL DEFAULT 0,
  valor_pago numeric(12,2) NOT NULL DEFAULT 0, metodo_pagamento public.pagamento_metodo,
  estado public.reserva_estado NOT NULL DEFAULT 'reservada', observacoes text,
  checkin_em timestamptz, checkout_em timestamptz, cancelada_em timestamptz, motivo_cancelamento text,
  user_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_datas CHECK (checkout > checkin));
CREATE TABLE public.reserva_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'restaurante', descricao text NOT NULL,
  quantidade numeric(12,3) NOT NULL DEFAULT 1, preco_unitario numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0, user_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.reserva_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL, metodo public.pagamento_metodo NOT NULL DEFAULT 'dinheiro', referencia text,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id), user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarto_tipos, public.quartos, public.hospedes, public.reservas, public.reserva_consumos, public.reserva_pagamentos TO authenticated;
GRANT ALL ON public.quarto_tipos, public.quartos, public.hospedes, public.reservas, public.reserva_consumos, public.reserva_pagamentos TO service_role;

ALTER TABLE public.quarto_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quartos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hosp all" ON public.quarto_tipos FOR ALL TO authenticated USING (public.hosp_pode()) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "hosp all" ON public.quartos FOR ALL TO authenticated USING (public.hosp_pode()) WITH CHECK (public.hosp_pode());
CREATE POLICY "hosp all" ON public.hospedes FOR ALL TO authenticated USING (public.hosp_pode()) WITH CHECK (public.hosp_pode());
CREATE POLICY "hosp sel" ON public.reservas FOR SELECT TO authenticated USING (public.hosp_pode());
CREATE POLICY "hosp ins" ON public.reservas FOR INSERT TO authenticated WITH CHECK (public.hosp_pode());
CREATE POLICY "hosp upd" ON public.reservas FOR UPDATE TO authenticated USING (public.hosp_pode()) WITH CHECK (public.hosp_pode());
CREATE POLICY "hosp all" ON public.reserva_consumos FOR ALL TO authenticated USING (public.hosp_pode()) WITH CHECK (public.hosp_pode());
CREATE POLICY "hosp sel" ON public.reserva_pagamentos FOR SELECT TO authenticated USING (public.hosp_pode());
CREATE POLICY "hosp ins" ON public.reserva_pagamentos FOR INSERT TO authenticated WITH CHECK (public.hosp_pode());

CREATE TRIGGER trg_qt_upd BEFORE UPDATE ON public.quarto_tipos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_q_upd BEFORE UPDATE ON public.quartos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_h_upd BEFORE UPDATE ON public.hospedes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cálculo da reserva + validação de sobreposição
CREATE OR REPLACE FUNCTION public.reserva_calc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.estado IN ('reservada','checkin') AND EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.quarto_id = NEW.quarto_id AND r.id <> NEW.id
      AND r.estado IN ('reservada','checkin') AND r.checkin < NEW.checkout AND NEW.checkin < r.checkout) THEN
    RAISE EXCEPTION 'O quarto já tem uma reserva nessas datas';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.user_id := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.noites := NEW.checkout - NEW.checkin;
  NEW.valor_estadia := round(NEW.noites * NEW.preco_noite, 2);
  IF NEW.desconto > NEW.valor_estadia THEN NEW.desconto := NEW.valor_estadia; END IF;
  SELECT COALESCE(sum(total),0) INTO NEW.total_consumos FROM public.reserva_consumos WHERE reserva_id = NEW.id;
  NEW.total := NEW.valor_estadia - NEW.desconto + NEW.total_consumos;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reserva_calc BEFORE INSERT OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.reserva_calc();

CREATE OR REPLACE FUNCTION public.consumo_calc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_est text;
BEGIN
  SELECT estado::text INTO v_est FROM public.reservas WHERE id = COALESCE(NEW.reserva_id, OLD.reserva_id);
  IF v_est IN ('checkout','cancelada') THEN RAISE EXCEPTION 'Reserva encerrada — consumos não podem ser alterados'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.total := round(NEW.quantidade * NEW.preco_unitario, 2);
  NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_consumo_calc BEFORE INSERT OR UPDATE OR DELETE ON public.reserva_consumos FOR EACH ROW EXECUTE FUNCTION public.consumo_calc();

CREATE OR REPLACE FUNCTION public.consumo_totais() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.reservas SET updated_at = now() WHERE id = COALESCE(NEW.reserva_id, OLD.reserva_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_consumo_tot AFTER INSERT OR UPDATE OR DELETE ON public.reserva_consumos FOR EACH ROW EXECUTE FUNCTION public.consumo_totais();

CREATE OR REPLACE FUNCTION public.reserva_pagamento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.reservas%ROWTYPE; v_cat uuid; v_lanc uuid; v_nome text;
BEGIN
  SELECT * INTO r FROM public.reservas WHERE id = NEW.reserva_id FOR UPDATE;
  IF r.estado = 'cancelada' THEN RAISE EXCEPTION 'Reserva cancelada'; END IF;
  IF NEW.valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF NEW.valor > round(r.total - r.valor_pago, 2) + 0.009 THEN RAISE EXCEPTION 'Valor superior ao saldo em dívida'; END IF;
  SELECT nome INTO v_nome FROM public.hospedes WHERE id = r.hospede_id;
  SELECT id INTO v_cat FROM public.financeiro_categorias WHERE tipo = 'receita' AND is_active ORDER BY (nome ILIKE '%hosp%' OR nome ILIKE '%pens%') DESC LIMIT 1;
  INSERT INTO public.financeiro_lancamentos (descricao, tipo, status, valor, vencimento, pago_em, metodo, categoria_id, documento, user_id)
  VALUES ('Hospedagem — ' || COALESCE(v_nome,''), 'receita', 'pago', NEW.valor, current_date, now(), NEW.metodo, v_cat, 'RES-' || left(r.id::text,8), auth.uid())
  RETURNING id INTO v_lanc;
  NEW.lancamento_id := v_lanc; NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
  UPDATE public.reservas SET valor_pago = valor_pago + NEW.valor, metodo_pagamento = NEW.metodo WHERE id = r.id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reserva_pag BEFORE INSERT ON public.reserva_pagamentos FOR EACH ROW EXECUTE FUNCTION public.reserva_pagamento();

-- Acções
CREATE OR REPLACE FUNCTION public.reserva_acao(p_id uuid, p_acao text, p_data date DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.reservas%ROWTYPE;
BEGIN
  IF NOT public.hosp_pode() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO r FROM public.reservas WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF p_acao = 'checkin' THEN
    IF r.estado <> 'reservada' THEN RAISE EXCEPTION 'Só reservas pendentes podem fazer check-in'; END IF;
    UPDATE public.reservas SET estado = 'checkin', checkin_em = now() WHERE id = p_id;
    UPDATE public.quartos SET estado = 'ocupado' WHERE id = r.quarto_id;
  ELSIF p_acao = 'checkout' THEN
    IF r.estado <> 'checkin' THEN RAISE EXCEPTION 'Só hóspedes em casa podem fazer check-out'; END IF;
    IF r.total - r.valor_pago > 0.009 THEN RAISE EXCEPTION 'Conta por liquidar: falta pagar %', round(r.total - r.valor_pago,2); END IF;
    UPDATE public.reservas SET estado = 'checkout', checkout_em = now() WHERE id = p_id;
    UPDATE public.quartos SET estado = 'limpeza' WHERE id = r.quarto_id;
  ELSIF p_acao = 'estender' THEN
    IF r.estado NOT IN ('reservada','checkin') THEN RAISE EXCEPTION 'Reserva não pode ser estendida'; END IF;
    IF p_data IS NULL OR p_data <= r.checkout THEN RAISE EXCEPTION 'A nova data de saída deve ser posterior à actual'; END IF;
    UPDATE public.reservas SET checkout = p_data WHERE id = p_id;
  ELSIF p_acao = 'cancelar' THEN
    IF r.estado <> 'reservada' THEN RAISE EXCEPTION 'Só reservas sem check-in podem ser canceladas'; END IF;
    IF r.valor_pago > 0 THEN RAISE EXCEPTION 'Reserva com pagamentos não pode ser cancelada'; END IF;
    UPDATE public.reservas SET estado = 'cancelada', cancelada_em = now(), motivo_cancelamento = p_motivo WHERE id = p_id;
    UPDATE public.quartos SET estado = 'livre' WHERE id = r.quarto_id AND estado = 'reservado'
      AND NOT EXISTS (SELECT 1 FROM public.reservas x WHERE x.quarto_id = r.quarto_id AND x.id <> p_id AND x.estado IN ('reservada','checkin'));
  ELSE RAISE EXCEPTION 'Acção inválida'; END IF;
  INSERT INTO public.auditoria (user_id, user_nome, modulo, acao, entidade, entidade_id, descricao)
  VALUES (auth.uid(), (SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Hospedagem', p_acao, 'reservas', p_id::text, p_acao || ' da reserva');
END $$;
REVOKE ALL ON FUNCTION public.reserva_acao(uuid,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserva_acao(uuid,text,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.reserva_calc(), public.consumo_calc(), public.consumo_totais(), public.reserva_pagamento() FROM PUBLIC, anon, authenticated;