
-- =====================================================================
-- SEED / BOOTSTRAP SCRIPT (idempotente — pode ser executado várias vezes)
-- Garante permissões e a existência do primeiro administrador.
-- =====================================================================

-- 1) Permissões da função has_role (usada por RLS e server functions)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 2) Garantir grants base nas tabelas críticas (caso algum tenha sido revogado)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL   ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3) Trigger que cria o profile e promove o primeiro utilizador a admin
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Backfill: se já existem utilizadores mas nenhum admin, promover o mais antigo
DO $$
DECLARE
  primeiro_user uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    SELECT id INTO primeiro_user
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;

    IF primeiro_user IS NOT NULL THEN
      -- Garantir profile
      INSERT INTO public.profiles (id, full_name)
      SELECT primeiro_user, COALESCE(
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = primeiro_user),
        split_part((SELECT email FROM auth.users WHERE id = primeiro_user), '@', 1)
      )
      ON CONFLICT (id) DO NOTHING;

      -- Promover a admin
      INSERT INTO public.user_roles (user_id, role)
      VALUES (primeiro_user, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;

      RAISE NOTICE 'Utilizador % promovido a administrador (seed).', primeiro_user;
    END IF;
  END IF;
END $$;
