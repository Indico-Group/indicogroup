
CREATE TYPE public.financeiro_tipo AS ENUM ('receita','despesa');
CREATE TYPE public.financeiro_status AS ENUM ('pendente','pago','cancelado');

CREATE TABLE public.financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.financeiro_tipo NOT NULL,
  cor text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_categorias TO authenticated;
GRANT ALL ON public.financeiro_categorias TO service_role;
ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cat_select" ON public.financeiro_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_cat_insert" ON public.financeiro_categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin_cat_update" ON public.financeiro_categorias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fin_cat_delete" ON public.financeiro_categorias FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_fin_cat_updated BEFORE UPDATE ON public.financeiro_categorias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  tipo public.financeiro_tipo NOT NULL,
  status public.financeiro_status NOT NULL DEFAULT 'pendente',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL DEFAULT CURRENT_DATE,
  pago_em timestamptz,
  metodo public.pagamento_metodo,
  categoria_id uuid REFERENCES public.financeiro_categorias(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  documento text,
  observacoes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_lanc_select" ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_lanc_insert" ON public.financeiro_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin_lanc_update" ON public.financeiro_lancamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fin_lanc_delete" ON public.financeiro_lancamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_fin_lanc_updated BEFORE UPDATE ON public.financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_fin_lanc_venc ON public.financeiro_lancamentos (vencimento);
CREATE INDEX idx_fin_lanc_status ON public.financeiro_lancamentos (status);

INSERT INTO public.financeiro_categorias (nome, tipo, cor) VALUES
 ('Vendas','receita','#16a34a'),
 ('Serviços','receita','#0ea5e9'),
 ('Outras receitas','receita','#a855f7'),
 ('Salários','despesa','#ef4444'),
 ('Fornecedores','despesa','#f97316'),
 ('Renda','despesa','#8b5cf6'),
 ('Água e Luz','despesa','#eab308'),
 ('Impostos','despesa','#64748b'),
 ('Manutenção','despesa','#14b8a6'),
 ('Outras despesas','despesa','#94a3b8');
