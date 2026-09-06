CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nome text,
  modulo text NOT NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  descricao text,
  detalhes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_created_at ON public.auditoria (created_at DESC);
CREATE INDEX idx_auditoria_modulo ON public.auditoria (modulo);

GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e gerente veem auditoria" ON public.auditoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Autenticados registam auditoria" ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);