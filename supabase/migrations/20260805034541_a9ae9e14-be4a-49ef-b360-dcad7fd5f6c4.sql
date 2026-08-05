CREATE TYPE public.presenca_estado AS ENUM ('presente','falta','falta_justificada','ferias','folga','meio_periodo');

CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  cargo text,
  telefone text,
  email text,
  documento text,
  morada text,
  turno text,
  salario_base numeric(12,2) NOT NULL DEFAULT 0,
  subsidios numeric(12,2) NOT NULL DEFAULT 0,
  desconto_percent numeric(5,2) NOT NULL DEFAULT 0,
  valor_hora_extra numeric(12,2) NOT NULL DEFAULT 0,
  admitido_em date,
  saiu_em date,
  foto_url text,
  notas text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO authenticated;
GRANT ALL ON public.funcionarios TO service_role;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY funcionarios_select ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY funcionarios_insert ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY funcionarios_update ON public.funcionarios FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY funcionarios_delete ON public.funcionarios FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  estado public.presenca_estado NOT NULL DEFAULT 'presente',
  horas numeric(5,2) NOT NULL DEFAULT 8,
  horas_extra numeric(5,2) NOT NULL DEFAULT 0,
  observacoes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas TO authenticated;
GRANT ALL ON public.presencas TO service_role;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY presencas_select ON public.presencas FOR SELECT TO authenticated USING (true);
CREATE POLICY presencas_insert ON public.presencas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY presencas_update ON public.presencas FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY presencas_delete ON public.presencas FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

CREATE TRIGGER trg_presencas_updated BEFORE UPDATE ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_presencas_data ON public.presencas(data);
CREATE INDEX idx_presencas_func ON public.presencas(funcionario_id);