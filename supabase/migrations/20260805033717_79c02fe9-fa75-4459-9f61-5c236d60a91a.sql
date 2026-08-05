ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS recibo_modelo text NOT NULL DEFAULT 'termico',
  ADD COLUMN IF NOT EXISTS recibo_densidade text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS recibo_margem_mm numeric;

ALTER TABLE public.configuracoes DROP CONSTRAINT IF EXISTS configuracoes_recibo_modelo_check;
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_recibo_modelo_check CHECK (recibo_modelo IN ('termico','a4'));
ALTER TABLE public.configuracoes DROP CONSTRAINT IF EXISTS configuracoes_recibo_densidade_check;
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_recibo_densidade_check CHECK (recibo_densidade IN ('auto','compacta','normal','ampla'));