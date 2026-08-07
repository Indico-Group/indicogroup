REVOKE EXECUTE ON FUNCTION public.processar_compra_recebida() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_movimento_estoque() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_venda_paga() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_venda_paga_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;