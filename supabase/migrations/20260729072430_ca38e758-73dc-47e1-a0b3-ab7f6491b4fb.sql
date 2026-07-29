
CREATE OR REPLACE FUNCTION public.corrigir_instalacao()
RETURNS TABLE(accao text, resultado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_admins int;
  v_oldest uuid;
BEGIN
  -- 1) GRANTs
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role';
    accao := 'GRANT EXECUTE has_role'; resultado := 'Aplicado';
  EXCEPTION WHEN OTHERS THEN
    accao := 'GRANT EXECUTE has_role'; resultado := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;

  BEGIN
    EXECUTE 'GRANT SELECT ON public.user_roles TO authenticated';
    EXECUTE 'GRANT ALL ON public.user_roles TO service_role';
    accao := 'GRANTs user_roles'; resultado := 'Aplicado';
  EXCEPTION WHEN OTHERS THEN
    accao := 'GRANTs user_roles'; resultado := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;

  BEGIN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated';
    EXECUTE 'GRANT ALL ON public.profiles TO service_role';
    accao := 'GRANTs profiles'; resultado := 'Aplicado';
  EXCEPTION WHEN OTHERS THEN
    accao := 'GRANTs profiles'; resultado := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;

  -- 2) Trigger on_auth_user_created
  BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
    accao := 'Trigger on_auth_user_created'; resultado := 'Recriado';
  EXCEPTION WHEN OTHERS THEN
    accao := 'Trigger on_auth_user_created'; resultado := 'Erro: ' || SQLERRM;
  END;
  RETURN NEXT;

  -- 3) Promover 1º admin se ausente
  SELECT COUNT(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  IF v_admins = 0 THEN
    SELECT id INTO v_oldest FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF v_oldest IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_oldest, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
      accao := 'Promoção 1º admin'; resultado := 'Utilizador ' || v_oldest::text || ' promovido';
    ELSE
      accao := 'Promoção 1º admin'; resultado := 'Sem utilizadores para promover';
    END IF;
  ELSE
    accao := 'Promoção 1º admin'; resultado := 'Já existe(m) ' || v_admins || ' admin(s)';
  END IF;
  RETURN NEXT;

  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.corrigir_instalacao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_instalacao() TO service_role;
