ALTER TABLE public.reserva_consumos ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id);

CREATE OR REPLACE FUNCTION public.consumo_estoque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.produto_id IS NOT NULL THEN
    INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
    VALUES (NEW.produto_id, 'venda', NEW.quantidade, 0, 0, 'Consumo de hóspede', 'reserva:' || NEW.reserva_id, auth.uid());
  ELSIF TG_OP = 'DELETE' AND OLD.produto_id IS NOT NULL THEN
    INSERT INTO public.movimentos_estoque (produto_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo, referencia, user_id)
    VALUES (OLD.produto_id, 'ajuste', OLD.quantidade, 0, 0, 'Consumo de hóspede removido', 'reserva:' || OLD.reserva_id, auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.consumo_estoque() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_consumo_estoque ON public.reserva_consumos;
CREATE TRIGGER trg_consumo_estoque AFTER INSERT OR DELETE ON public.reserva_consumos
FOR EACH ROW EXECUTE FUNCTION public.consumo_estoque();