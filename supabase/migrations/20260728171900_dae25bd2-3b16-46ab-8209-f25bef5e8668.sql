
-- =====================================================================
-- ROTINA DE VERIFICAÇÃO PÓS-SEED
-- Uso:  SELECT * FROM public.verificar_instalacao();
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verificar_instalacao()
RETURNS TABLE(verificacao text, status text, detalhe text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admins int;
  v_users  int;
  v_trigger_ok boolean;
  v_has_role_ok boolean;
  v_grant_userroles_ok boolean;
  v_grant_profiles_ok boolean;
BEGIN
  -- 1) Existe pelo menos um admin?
  SELECT COUNT(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  SELECT COUNT(*) INTO v_users  FROM auth.users;
  verificacao := '1º Administrador';
  IF v_admins > 0 THEN
    status := 'OK'; detalhe := v_admins || ' administrador(es) registado(s).';
  ELSIF v_users = 0 THEN
    status := 'PENDENTE'; detalhe := 'Nenhum utilizador ainda — o 1º registo será promovido automaticamente.';
  ELSE
    status := 'FALHA'; detalhe := 'Existem utilizadores mas nenhum admin. Executar o seed novamente.';
  END IF;
  RETURN NEXT;

  -- 2) Trigger on_auth_user_created presente
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created' AND NOT tgisinternal
  ) INTO v_trigger_ok;
  verificacao := 'Trigger promoção (on_auth_user_created)';
  status := CASE WHEN v_trigger_ok THEN 'OK' ELSE 'FALHA' END;
  detalhe := CASE WHEN v_trigger_ok
             THEN 'Trigger activo em auth.users.'
             ELSE 'Trigger em falta — o próximo utilizador não será promovido.' END;
  RETURN NEXT;

  -- 3) GRANT EXECUTE em has_role para authenticated
  SELECT has_function_privilege('authenticated',
    'public.has_role(uuid, public.app_role)', 'EXECUTE') INTO v_has_role_ok;
  verificacao := 'GRANT EXECUTE has_role → authenticated';
  status := CASE WHEN v_has_role_ok THEN 'OK' ELSE 'FALHA' END;
  detalhe := CASE WHEN v_has_role_ok
             THEN 'Middleware admin funcional.'
             ELSE 'Sem permissão — server functions vão falhar.' END;
  RETURN NEXT;

  -- 4) GRANT SELECT em user_roles para authenticated
  SELECT has_table_privilege('authenticated', 'public.user_roles', 'SELECT')
    INTO v_grant_userroles_ok;
  verificacao := 'GRANT SELECT user_roles → authenticated';
  status := CASE WHEN v_grant_userroles_ok THEN 'OK' ELSE 'FALHA' END;
  detalhe := CASE WHEN v_grant_userroles_ok THEN 'Leitura de papéis permitida.' ELSE 'GRANT em falta.' END;
  RETURN NEXT;

  -- 5) GRANTs em profiles para authenticated
  SELECT has_table_privilege('authenticated', 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE')
    INTO v_grant_profiles_ok;
  verificacao := 'GRANTs CRUD profiles → authenticated';
  status := CASE WHEN v_grant_profiles_ok THEN 'OK' ELSE 'FALHA' END;
  detalhe := CASE WHEN v_grant_profiles_ok THEN 'Gestão de perfis permitida.' ELSE 'GRANTs em falta.' END;
  RETURN NEXT;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_instalacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_instalacao() TO authenticated, service_role;
