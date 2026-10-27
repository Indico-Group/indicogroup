-- Bloqueia a aprovação da folha quando existirem dias de assiduidade por confirmar.
-- O registo explícito pode ser presença, falta, folga, férias, licença ou outro estado válido.
-- A validação considera o período de emprego e só vai até hoje no mês corrente.
CREATE OR REPLACE FUNCTION public.validar_transicao_folha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_mes date;
  v_fim_mes date;
  v_limite date;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissao para alterar o estado da folha salarial';
  END IF;

  IF OLD.status = 'paga' THEN
    RAISE EXCEPTION 'Uma folha paga nao pode mudar de estado; use um processo de estorno auditado';

  ELSIF OLD.status = 'rascunho' AND NEW.status = 'aprovada' THEN
    IF NOT EXISTS (SELECT 1 FROM public.folha_itens WHERE folha_id = OLD.id) THEN
      RAISE EXCEPTION 'Nao e possivel aprovar uma folha sem funcionarios';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.folha_itens
      WHERE folha_id = OLD.id AND liquido < 0
    ) THEN
      RAISE EXCEPTION 'Existem valores liquidos invalidos na folha';
    END IF;

    v_inicio_mes := to_date(OLD.mes || '-01', 'YYYY-MM-DD');
    v_fim_mes := (v_inicio_mes + interval '1 month - 1 day')::date;
    v_limite := LEAST(v_fim_mes, CURRENT_DATE);

    IF EXISTS (
      SELECT 1
      FROM public.folha_itens fi
      JOIN public.funcionarios f ON f.id = fi.funcionario_id
      CROSS JOIN LATERAL generate_series(
        GREATEST(COALESCE(f.admitido_em, v_inicio_mes), v_inicio_mes)::timestamp,
        LEAST(COALESCE(f.saiu_em, v_limite), v_limite)::timestamp,
        interval '1 day'
      ) AS calendario(dia)
      WHERE fi.folha_id = OLD.id
        AND GREATEST(COALESCE(f.admitido_em, v_inicio_mes), v_inicio_mes)
            <= LEAST(COALESCE(f.saiu_em, v_limite), v_limite)
        AND NOT EXISTS (
          SELECT 1
          FROM public.presencas p
          WHERE p.funcionario_id = f.id
            AND p.data = calendario.dia::date
        )
    ) THEN
      RAISE EXCEPTION 'Assiduidade incompleta: registe presença, falta, folga, férias ou licença em todos os dias exigidos antes de aprovar a folha';
    END IF;

  ELSIF OLD.status = 'aprovada' AND NEW.status = 'fechada' THEN
    IF EXISTS (
      SELECT 1 FROM public.folha_itens
      WHERE folha_id = OLD.id AND status_pagamento = 'pago' AND lancamento_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Existem pagamentos sem lancamento financeiro associado';
    END IF;

  ELSIF OLD.status = 'fechada' AND NEW.status = 'paga' THEN
    IF EXISTS (
      SELECT 1 FROM public.folha_itens
      WHERE folha_id = OLD.id AND status_pagamento <> 'pago'
    ) THEN
      RAISE EXCEPTION 'A folha so pode ser marcada como paga quando todos os funcionarios estiverem pagos';
    END IF;

  ELSIF OLD.status IN ('aprovada', 'fechada') AND NEW.status = 'rascunho' THEN
    IF NEW.observacoes IS NULL OR trim(NEW.observacoes) = ''
       OR NEW.observacoes IS NOT DISTINCT FROM OLD.observacoes THEN
      RAISE EXCEPTION 'Para reabrir a folha, registe um motivo novo nas observacoes';
    END IF;

  ELSE
    RAISE EXCEPTION 'Transicao de folha nao permitida: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
