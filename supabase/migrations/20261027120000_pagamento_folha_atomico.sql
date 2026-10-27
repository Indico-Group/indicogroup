-- Pagamento salarial atomico e idempotente: evita lancamentos duplicados
-- quando a rede falha ou o utilizador repete a acao.
CREATE OR REPLACE FUNCTION public.pagar_item_folha(
  p_item_id uuid,
  p_metodo public.pagamento_metodo,
  p_referencia text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.folha_itens%ROWTYPE;
  v_folha public.folhas_salariais%ROWTYPE;
  v_lancamento_id uuid;
  v_agora timestamptz := now();
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissao para pagar salarios';
  END IF;

  SELECT * INTO v_item
  FROM public.folha_itens
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item salarial nao encontrado';
  END IF;

  SELECT * INTO v_folha
  FROM public.folhas_salariais
  WHERE id = v_item.folha_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folha salarial nao encontrada';
  END IF;

  -- Repetir a mesma acao nao cria uma segunda despesa.
  IF v_item.status_pagamento = 'pago' THEN
    IF v_item.lancamento_id IS NULL THEN
      RAISE EXCEPTION 'Item marcado como pago sem lancamento financeiro; requer auditoria';
    END IF;
    RETURN v_item.lancamento_id;
  END IF;

  IF v_folha.status <> 'fechada' THEN
    RAISE EXCEPTION 'A folha deve estar fechada antes de efectuar pagamentos';
  END IF;

  IF v_item.liquido < 0 THEN
    RAISE EXCEPTION 'O valor liquido nao pode ser negativo';
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    descricao, tipo, status, valor, vencimento, pago_em, metodo, documento, observacoes
  ) VALUES (
    'Salario ' || v_folha.mes || ' - ' || v_item.nome_funcionario,
    'despesa', 'pago', v_item.liquido, CURRENT_DATE, v_agora, p_metodo,
    NULLIF(trim(COALESCE(p_referencia, '')), ''),
    'Folha salarial ' || v_folha.mes || '; item=' || v_item.id::text
  ) RETURNING id INTO v_lancamento_id;

  UPDATE public.folha_itens
  SET status_pagamento = 'pago',
      pago_em = v_agora,
      metodo_pagamento = p_metodo,
      referencia_pagamento = NULLIF(trim(COALESCE(p_referencia, '')), ''),
      lancamento_id = v_lancamento_id
  WHERE id = v_item.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.folha_itens
    WHERE folha_id = v_folha.id AND status_pagamento <> 'pago'
  ) THEN
    UPDATE public.folhas_salariais
    SET status = 'paga'
    WHERE id = v_folha.id AND status = 'fechada';
  END IF;

  RETURN v_lancamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pagar_item_folha(uuid, public.pagamento_metodo, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_item_folha(uuid, public.pagamento_metodo, text) TO authenticated, service_role;
