-- Controla transicoes do ciclo de vida da folha no banco, nao apenas na interface.
CREATE OR REPLACE FUNCTION public.validar_transicao_folha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

DROP TRIGGER IF EXISTS trg_validar_transicao_folha ON public.folhas_salariais;
CREATE TRIGGER trg_validar_transicao_folha
BEFORE UPDATE OF status ON public.folhas_salariais
FOR EACH ROW EXECUTE FUNCTION public.validar_transicao_folha();
