-- ===================== FUNCIONÁRIOS: campos adicionais =====================
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS estabelecimento text,
  ADD COLUMN IF NOT EXISTS tipo_contrato text,
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS bonus numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_descontos numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconta_faltas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metodo_pagamento public.pagamento_metodo;

-- Acesso a funcionários restrito a admin/gerente (dados salariais)
DROP POLICY IF EXISTS funcionarios_select ON public.funcionarios;
CREATE POLICY funcionarios_select ON public.funcionarios FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

-- ===================== PRESENÇAS: novos estados e justificações =====================
ALTER TYPE public.presenca_estado ADD VALUE IF NOT EXISTS 'atraso';
ALTER TYPE public.presenca_estado ADD VALUE IF NOT EXISTS 'licenca';

ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS minutos_atraso integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS justificacao text,
  ADD COLUMN IF NOT EXISTS justificacao_estado text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

DROP POLICY IF EXISTS presencas_select ON public.presencas;
DROP POLICY IF EXISTS presencas_insert ON public.presencas;
DROP POLICY IF EXISTS presencas_update ON public.presencas;
CREATE POLICY presencas_select ON public.presencas FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY presencas_insert ON public.presencas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY presencas_update ON public.presencas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

-- ===================== HISTÓRICO SALARIAL =====================
CREATE TABLE IF NOT EXISTS public.funcionario_salario_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  salario_anterior numeric(12,2),
  salario_novo numeric(12,2),
  subsidios_anterior numeric(12,2),
  subsidios_novo numeric(12,2),
  bonus_anterior numeric(12,2),
  bonus_novo numeric(12,2),
  motivo text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.funcionario_salario_historico TO authenticated;
GRANT ALL ON public.funcionario_salario_historico TO service_role;
ALTER TABLE public.funcionario_salario_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY hist_select ON public.funcionario_salario_historico FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY hist_insert ON public.funcionario_salario_historico FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE INDEX IF NOT EXISTS idx_hist_func ON public.funcionario_salario_historico(funcionario_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.registar_historico_salarial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.funcionario_salario_historico
      (funcionario_id, salario_anterior, salario_novo, subsidios_anterior, subsidios_novo, bonus_anterior, bonus_novo, motivo, user_id)
    VALUES (NEW.id, NULL, NEW.salario_base, NULL, NEW.subsidios, NULL, NEW.bonus, 'Admissão / registo inicial', auth.uid());
  ELSIF NEW.salario_base IS DISTINCT FROM OLD.salario_base
     OR NEW.subsidios IS DISTINCT FROM OLD.subsidios
     OR NEW.bonus IS DISTINCT FROM OLD.bonus THEN
    INSERT INTO public.funcionario_salario_historico
      (funcionario_id, salario_anterior, salario_novo, subsidios_anterior, subsidios_novo, bonus_anterior, bonus_novo, motivo, user_id)
    VALUES (NEW.id, OLD.salario_base, NEW.salario_base, OLD.subsidios, NEW.subsidios, OLD.bonus, NEW.bonus, 'Alteração salarial', auth.uid());
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_funcionarios_hist ON public.funcionarios;
CREATE TRIGGER trg_funcionarios_hist AFTER INSERT OR UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.registar_historico_salarial();

-- ===================== ADIANTAMENTOS =====================
CREATE TABLE IF NOT EXISTS public.adiantamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL DEFAULT CURRENT_DATE,
  mes_referencia text NOT NULL,
  motivo text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adiantamentos TO authenticated;
GRANT ALL ON public.adiantamentos TO service_role;
ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY adiant_all ON public.adiantamentos FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE INDEX IF NOT EXISTS idx_adiant_mes ON public.adiantamentos(mes_referencia, funcionario_id);

-- ===================== FOLHAS SALARIAIS =====================
DO $$ BEGIN
  CREATE TYPE public.folha_status AS ENUM ('rascunho','aprovada','fechada','paga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.folhas_salariais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL UNIQUE,
  status public.folha_status NOT NULL DEFAULT 'rascunho',
  dias_base integer NOT NULL DEFAULT 30,
  total_base numeric(14,2) NOT NULL DEFAULT 0,
  total_extras numeric(14,2) NOT NULL DEFAULT 0,
  total_subsidios numeric(14,2) NOT NULL DEFAULT 0,
  total_descontos numeric(14,2) NOT NULL DEFAULT 0,
  total_liquido numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  user_id uuid,
  aprovada_por uuid, aprovada_em timestamptz,
  fechada_por uuid, fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folhas_salariais TO authenticated;
GRANT ALL ON public.folhas_salariais TO service_role;
ALTER TABLE public.folhas_salariais ENABLE ROW LEVEL SECURITY;
CREATE POLICY folhas_all ON public.folhas_salariais FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE TRIGGER trg_folhas_updated BEFORE UPDATE ON public.folhas_salariais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.folha_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_id uuid NOT NULL REFERENCES public.folhas_salariais(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id),
  nome_funcionario text NOT NULL,
  codigo text,
  cargo text,
  departamento text,
  estabelecimento text,
  salario_base numeric(12,2) NOT NULL DEFAULT 0,
  valor_dia numeric(12,4) NOT NULL DEFAULT 0,
  dias_presentes integer NOT NULL DEFAULT 0,
  atrasos integer NOT NULL DEFAULT 0,
  faltas_justificadas integer NOT NULL DEFAULT 0,
  faltas_injustificadas integer NOT NULL DEFAULT 0,
  horas_extra numeric(8,2) NOT NULL DEFAULT 0,
  valor_horas_extra numeric(12,2) NOT NULL DEFAULT 0,
  subsidios numeric(12,2) NOT NULL DEFAULT 0,
  bonus numeric(12,2) NOT NULL DEFAULT 0,
  desconto_faltas numeric(12,2) NOT NULL DEFAULT 0,
  adiantamentos numeric(12,2) NOT NULL DEFAULT 0,
  outros_descontos numeric(12,2) NOT NULL DEFAULT 0,
  liquido numeric(12,2) NOT NULL DEFAULT 0,
  status_pagamento text NOT NULL DEFAULT 'pendente',
  pago_em timestamptz,
  metodo_pagamento public.pagamento_metodo,
  referencia_pagamento text,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folha_id, funcionario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_itens TO authenticated;
GRANT ALL ON public.folha_itens TO service_role;
ALTER TABLE public.folha_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_itens_all ON public.folha_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE TRIGGER trg_folha_itens_updated BEFORE UPDATE ON public.folha_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_folha_itens_folha ON public.folha_itens(folha_id);

-- ===================== PROTECÇÃO DE FOLHAS FECHADAS =====================
CREATE OR REPLACE FUNCTION public.proteger_folha_fechada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.folha_status;
BEGIN
  IF TG_TABLE_NAME = 'folhas_salariais' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status IN ('fechada','paga') THEN
        RAISE EXCEPTION 'Folha % está fechada e não pode ser apagada', OLD.mes;
      END IF;
      RETURN OLD;
    END IF;
    -- Reabertura só é permitida com observação (autorização explícita)
    IF OLD.status IN ('fechada','paga') AND NEW.status NOT IN ('fechada','paga')
       AND (NEW.observacoes IS NULL OR NEW.observacoes = OLD.observacoes) THEN
      RAISE EXCEPTION 'Para reabrir uma folha fechada indique o motivo nas observações';
    END IF;
    RETURN NEW;
  END IF;

  -- folha_itens
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.folhas_salariais WHERE id = OLD.folha_id;
    IF v_status IN ('fechada','paga') THEN
      RAISE EXCEPTION 'A folha está fechada — itens não podem ser removidos';
    END IF;
    RETURN OLD;
  END IF;
  SELECT status INTO v_status FROM public.folhas_salariais WHERE id = NEW.folha_id;
  IF v_status IN ('fechada','paga') AND (
       NEW.salario_base IS DISTINCT FROM OLD.salario_base OR NEW.horas_extra IS DISTINCT FROM OLD.horas_extra
    OR NEW.valor_horas_extra IS DISTINCT FROM OLD.valor_horas_extra OR NEW.subsidios IS DISTINCT FROM OLD.subsidios
    OR NEW.bonus IS DISTINCT FROM OLD.bonus OR NEW.faltas_injustificadas IS DISTINCT FROM OLD.faltas_injustificadas
    OR NEW.desconto_faltas IS DISTINCT FROM OLD.desconto_faltas OR NEW.adiantamentos IS DISTINCT FROM OLD.adiantamentos
    OR NEW.outros_descontos IS DISTINCT FROM OLD.outros_descontos OR NEW.liquido IS DISTINCT FROM OLD.liquido) THEN
    RAISE EXCEPTION 'A folha está fechada — valores não podem ser alterados (reabra a folha primeiro)';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_folhas_protege ON public.folhas_salariais;
CREATE TRIGGER trg_folhas_protege BEFORE UPDATE OR DELETE ON public.folhas_salariais FOR EACH ROW EXECUTE FUNCTION public.proteger_folha_fechada();
DROP TRIGGER IF EXISTS trg_folha_itens_protege ON public.folha_itens;
CREATE TRIGGER trg_folha_itens_protege BEFORE UPDATE OR DELETE ON public.folha_itens FOR EACH ROW EXECUTE FUNCTION public.proteger_folha_fechada();

-- ===================== AUDITORIA AUTOMÁTICA DE ELIMINAÇÕES E ALTERAÇÕES RH =====================
CREATE OR REPLACE FUNCTION public.auditar_rh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_acao text; v_ent_id text; v_det jsonb;
BEGIN
  SELECT full_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_acao := 'apagar'; v_ent_id := OLD.id::text; v_det := jsonb_build_object('anterior', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'actualizar'; v_ent_id := NEW.id::text;
    v_det := jsonb_build_object('anterior', to_jsonb(OLD), 'novo', to_jsonb(NEW));
  ELSE
    v_acao := 'criar'; v_ent_id := NEW.id::text; v_det := jsonb_build_object('novo', to_jsonb(NEW));
  END IF;
  INSERT INTO public.auditoria (user_id, user_nome, modulo, acao, entidade, entidade_id, descricao, detalhes)
  VALUES (auth.uid(), v_nome, 'RH', v_acao, TG_TABLE_NAME, v_ent_id,
          TG_OP || ' em ' || TG_TABLE_NAME, v_det);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_aud_presencas ON public.presencas;
CREATE TRIGGER trg_aud_presencas AFTER UPDATE OR DELETE ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.auditar_rh();
DROP TRIGGER IF EXISTS trg_aud_adiantamentos ON public.adiantamentos;
CREATE TRIGGER trg_aud_adiantamentos AFTER UPDATE OR DELETE ON public.adiantamentos FOR EACH ROW EXECUTE FUNCTION public.auditar_rh();
DROP TRIGGER IF EXISTS trg_aud_folha_itens ON public.folha_itens;
CREATE TRIGGER trg_aud_folha_itens AFTER UPDATE OR DELETE ON public.folha_itens FOR EACH ROW EXECUTE FUNCTION public.auditar_rh();
DROP TRIGGER IF EXISTS trg_aud_folhas ON public.folhas_salariais;
CREATE TRIGGER trg_aud_folhas AFTER UPDATE OR DELETE ON public.folhas_salariais FOR EACH ROW EXECUTE FUNCTION public.auditar_rh();
DROP TRIGGER IF EXISTS trg_aud_funcionarios ON public.funcionarios;
CREATE TRIGGER trg_aud_funcionarios AFTER UPDATE OR DELETE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.auditar_rh();

-- ===================== GERAÇÃO / RECÁLCULO DA FOLHA =====================
CREATE OR REPLACE FUNCTION public.gerar_folha(p_mes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_folha_id uuid;
  v_status public.folha_status;
  v_ini date; v_fim date;
  f RECORD;
  v_presentes int; v_atrasos int; v_fj int; v_fi int; v_hx numeric; v_adiant numeric;
  v_valor_dia numeric; v_desc_faltas numeric; v_extras numeric; v_outros numeric; v_liquido numeric;
  t_base numeric := 0; t_extras numeric := 0; t_subs numeric := 0; t_desc numeric := 0; t_liq numeric := 0;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para processar a folha salarial';
  END IF;
  IF p_mes !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Mês inválido (use AAAA-MM)'; END IF;
  v_ini := to_date(p_mes || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;

  SELECT id, status INTO v_folha_id, v_status FROM public.folhas_salariais WHERE mes = p_mes;
  IF v_folha_id IS NULL THEN
    INSERT INTO public.folhas_salariais (mes, user_id) VALUES (p_mes, auth.uid()) RETURNING id INTO v_folha_id;
  ELSIF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'A folha de % já está % — reabra-a para recalcular', p_mes, v_status;
  END IF;

  DELETE FROM public.folha_itens WHERE folha_id = v_folha_id;

  FOR f IN SELECT * FROM public.funcionarios
           WHERE is_active = true
             AND (admitido_em IS NULL OR admitido_em <= v_fim)
             AND (saiu_em IS NULL OR saiu_em >= v_ini)
           ORDER BY nome LOOP
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('presente','meio_periodo','atraso')),
      COUNT(*) FILTER (WHERE estado = 'atraso'),
      COUNT(*) FILTER (WHERE estado = 'falta_justificada' OR (estado = 'falta' AND justificacao_estado = 'aprovada')),
      COUNT(*) FILTER (WHERE estado = 'falta' AND COALESCE(justificacao_estado,'') <> 'aprovada'),
      COALESCE(SUM(horas_extra),0)
    INTO v_presentes, v_atrasos, v_fj, v_fi, v_hx
    FROM public.presencas WHERE funcionario_id = f.id AND data BETWEEN v_ini AND v_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_adiant FROM public.adiantamentos
      WHERE funcionario_id = f.id AND mes_referencia = p_mes;

    v_valor_dia := f.salario_base / 30.0;
    v_desc_faltas := CASE WHEN f.desconta_faltas THEN ROUND(v_fi * v_valor_dia, 2) ELSE 0 END;
    v_extras := ROUND(v_hx * f.valor_hora_extra, 2);
    v_outros := ROUND(f.outros_descontos + (f.salario_base * f.desconto_percent / 100.0), 2);
    v_liquido := ROUND(f.salario_base + v_extras + f.subsidios + f.bonus - v_desc_faltas - v_adiant - v_outros, 2);

    INSERT INTO public.folha_itens (folha_id, funcionario_id, nome_funcionario, codigo, cargo, departamento, estabelecimento,
      salario_base, valor_dia, dias_presentes, atrasos, faltas_justificadas, faltas_injustificadas,
      horas_extra, valor_horas_extra, subsidios, bonus, desconto_faltas, adiantamentos, outros_descontos, liquido,
      metodo_pagamento)
    VALUES (v_folha_id, f.id, f.nome, f.codigo, f.cargo, f.departamento, f.estabelecimento,
      f.salario_base, v_valor_dia, v_presentes, v_atrasos, v_fj, v_fi,
      v_hx, v_extras, f.subsidios, f.bonus, v_desc_faltas, v_adiant, v_outros, v_liquido,
      f.metodo_pagamento);

    t_base := t_base + f.salario_base; t_extras := t_extras + v_extras;
    t_subs := t_subs + f.subsidios + f.bonus;
    t_desc := t_desc + v_desc_faltas + v_adiant + v_outros; t_liq := t_liq + v_liquido;
  END LOOP;

  UPDATE public.folhas_salariais SET total_base = t_base, total_extras = t_extras, total_subsidios = t_subs,
    total_descontos = t_desc, total_liquido = t_liq WHERE id = v_folha_id;
  RETURN v_folha_id;
END; $$;
REVOKE ALL ON FUNCTION public.gerar_folha(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_folha(text) TO authenticated, service_role;