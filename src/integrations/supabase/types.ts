export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adiantamentos: {
        Row: {
          created_at: string
          data: string
          funcionario_id: string
          id: string
          mes_referencia: string
          motivo: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          funcionario_id: string
          id?: string
          mes_referencia: string
          motivo?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          mes_referencia?: string
          motivo?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "adiantamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          detalhes: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          modulo: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          modulo: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          modulo?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      caixa_movimentos: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          referencia: string | null
          sessao_id: string
          tipo: Database["public"]["Enums"]["caixa_movimento_tipo"]
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          referencia?: string | null
          sessao_id: string
          tipo: Database["public"]["Enums"]["caixa_movimento_tipo"]
          user_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          referencia?: string | null
          sessao_id?: string
          tipo?: Database["public"]["Enums"]["caixa_movimento_tipo"]
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_sessoes: {
        Row: {
          aberta_em: string
          created_at: string
          diferenca: number | null
          fechada_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          status: Database["public"]["Enums"]["caixa_status"]
          updated_at: string
          user_id: string
          valor_abertura: number
          valor_esperado: number | null
          valor_fechamento: number | null
        }
        Insert: {
          aberta_em?: string
          created_at?: string
          diferenca?: number | null
          fechada_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          status?: Database["public"]["Enums"]["caixa_status"]
          updated_at?: string
          user_id: string
          valor_abertura?: number
          valor_esperado?: number | null
          valor_fechamento?: number | null
        }
        Update: {
          aberta_em?: string
          created_at?: string
          diferenca?: number | null
          fechada_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          status?: Database["public"]["Enums"]["caixa_status"]
          updated_at?: string
          user_id?: string
          valor_abertura?: number
          valor_esperado?: number | null
          valor_fechamento?: number | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string | null
          created_at: string
          icone: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          aniversario: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          morada: string | null
          nif: string | null
          nome: string
          notas: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          aniversario?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          morada?: string | null
          nif?: string | null
          nome: string
          notas?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          aniversario?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          morada?: string | null
          nif?: string | null
          nome?: string
          notas?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compra_itens: {
        Row: {
          compra_id: string
          created_at: string
          id: string
          nome_produto: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          id?: string
          nome_produto: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          id?: string
          nome_produto?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          cancelada_em: string | null
          created_at: string
          data_prevista: string | null
          desconto: number
          documento: string | null
          fornecedor_id: string | null
          id: string
          numero: number
          observacoes: string | null
          recebida_em: string | null
          status: Database["public"]["Enums"]["compra_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancelada_em?: string | null
          created_at?: string
          data_prevista?: string | null
          desconto?: number
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          recebida_em?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancelada_em?: string | null
          created_at?: string
          data_prevista?: string | null
          desconto?: number
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          recebida_em?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          email: string | null
          id: number
          iva_percent: number
          logo_url: string | null
          mensagem_recibo: string | null
          moeda: string
          morada: string | null
          nif: string | null
          nome_empresa: string
          notificacoes_caixa: boolean
          notificacoes_estoque: boolean
          prefixo_recibo: string | null
          recibo_densidade: string
          recibo_margem_mm: number | null
          recibo_modelo: string
          rodape_recibo: string | null
          telefone: string | null
          tema: string
          tempo_sessao_min: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          email?: string | null
          id?: number
          iva_percent?: number
          logo_url?: string | null
          mensagem_recibo?: string | null
          moeda?: string
          morada?: string | null
          nif?: string | null
          nome_empresa?: string
          notificacoes_caixa?: boolean
          notificacoes_estoque?: boolean
          prefixo_recibo?: string | null
          recibo_densidade?: string
          recibo_margem_mm?: number | null
          recibo_modelo?: string
          rodape_recibo?: string | null
          telefone?: string | null
          tema?: string
          tempo_sessao_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          email?: string | null
          id?: number
          iva_percent?: number
          logo_url?: string | null
          mensagem_recibo?: string | null
          moeda?: string
          morada?: string | null
          nif?: string | null
          nome_empresa?: string
          notificacoes_caixa?: boolean
          notificacoes_estoque?: boolean
          prefixo_recibo?: string | null
          recibo_densidade?: string
          recibo_margem_mm?: number | null
          recibo_modelo?: string
          rodape_recibo?: string | null
          telefone?: string | null
          tema?: string
          tempo_sessao_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cotacao_itens: {
        Row: {
          codigo: string | null
          cotacao_id: string
          created_at: string
          desconto: number
          descricao: string
          id: string
          imposto_percent: number
          ordem: number
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
          total: number
          unidade: string | null
          valor_imposto: number
        }
        Insert: {
          codigo?: string | null
          cotacao_id: string
          created_at?: string
          desconto?: number
          descricao: string
          id?: string
          imposto_percent?: number
          ordem?: number
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
          total?: number
          unidade?: string | null
          valor_imposto?: number
        }
        Update: {
          codigo?: string | null
          cotacao_id?: string
          created_at?: string
          desconto?: number
          descricao?: string
          id?: string
          imposto_percent?: number
          ordem?: number
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
          total?: number
          unidade?: string | null
          valor_imposto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_nuit: string | null
          cliente_telefone: string | null
          condicoes: string | null
          convertida_em: string | null
          created_at: string
          data: string
          estabelecimento: string | null
          fatura_id: string | null
          forma_pagamento: string | null
          id: string
          numero: string
          observacoes: string | null
          prazo_entrega: string | null
          serie: string
          status: Database["public"]["Enums"]["cotacao_status"]
          subtotal: number
          total: number
          total_desconto: number
          total_imposto: number
          updated_at: string
          user_id: string | null
          validade: string | null
          venda_id: string | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_nuit?: string | null
          cliente_telefone?: string | null
          condicoes?: string | null
          convertida_em?: string | null
          created_at?: string
          data?: string
          estabelecimento?: string | null
          fatura_id?: string | null
          forma_pagamento?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          prazo_entrega?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["cotacao_status"]
          subtotal?: number
          total?: number
          total_desconto?: number
          total_imposto?: number
          updated_at?: string
          user_id?: string | null
          validade?: string | null
          venda_id?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_nuit?: string | null
          cliente_telefone?: string | null
          condicoes?: string | null
          convertida_em?: string | null
          created_at?: string
          data?: string
          estabelecimento?: string | null
          fatura_id?: string | null
          forma_pagamento?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["cotacao_status"]
          subtotal?: number
          total?: number
          total_desconto?: number
          total_imposto?: number
          updated_at?: string
          user_id?: string | null
          validade?: string | null
          venda_id?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_series: {
        Row: {
          ano: number
          created_at: string
          id: string
          prefixo: string
          serie: string
          tipo: string
          ultimo: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          prefixo: string
          serie?: string
          tipo: string
          ultimo?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          prefixo?: string
          serie?: string
          tipo?: string
          ultimo?: number
        }
        Relationships: []
      }
      fatura_itens: {
        Row: {
          codigo: string | null
          created_at: string
          desconto: number
          descricao: string
          fatura_id: string
          id: string
          imposto_percent: number
          ordem: number
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
          total: number
          unidade: string | null
          valor_imposto: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          desconto?: number
          descricao: string
          fatura_id: string
          id?: string
          imposto_percent?: number
          ordem?: number
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
          total?: number
          unidade?: string | null
          valor_imposto?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          desconto?: number
          descricao?: string
          fatura_id?: string
          id?: string
          imposto_percent?: number
          ordem?: number
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
          total?: number
          unidade?: string | null
          valor_imposto?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatura_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fatura_pagamentos: {
        Row: {
          created_at: string
          data: string
          fatura_id: string
          id: string
          lancamento_id: string | null
          metodo: Database["public"]["Enums"]["pagamento_metodo"]
          referencia: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          fatura_id: string
          id?: string
          lancamento_id?: string | null
          metodo?: Database["public"]["Enums"]["pagamento_metodo"]
          referencia?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          fatura_id?: string
          id?: string
          lancamento_id?: string | null
          metodo?: Database["public"]["Enums"]["pagamento_metodo"]
          referencia?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatura_pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_pagamentos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          cancelada_em: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_nuit: string | null
          cliente_telefone: string | null
          cotacao_id: string | null
          created_at: string
          data_emissao: string
          data_vencimento: string | null
          emitida_em: string | null
          estabelecimento: string | null
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          motivo_cancelamento: string | null
          numero: string
          observacoes: string | null
          serie: string
          status: Database["public"]["Enums"]["fatura_status"]
          subtotal: number
          total: number
          total_desconto: number
          total_imposto: number
          updated_at: string
          user_id: string | null
          valor_pago: number
          venda_id: string | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          cancelada_em?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_nuit?: string | null
          cliente_telefone?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_emissao?: string
          data_vencimento?: string | null
          emitida_em?: string | null
          estabelecimento?: string | null
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          motivo_cancelamento?: string | null
          numero: string
          observacoes?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["fatura_status"]
          subtotal?: number
          total?: number
          total_desconto?: number
          total_imposto?: number
          updated_at?: string
          user_id?: string | null
          valor_pago?: number
          venda_id?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          cancelada_em?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_nuit?: string | null
          cliente_telefone?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_emissao?: string
          data_vencimento?: string | null
          emitida_em?: string | null
          estabelecimento?: string | null
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          motivo_cancelamento?: string | null
          numero?: string
          observacoes?: string | null
          serie?: string
          status?: Database["public"]["Enums"]["fatura_status"]
          subtotal?: number
          total?: number
          total_desconto?: number
          total_imposto?: number
          updated_at?: string
          user_id?: string | null
          valor_pago?: number
          venda_id?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_cotacao_fk"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_categorias: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          is_active: boolean
          nome: string
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          tipo?: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_lancamentos: {
        Row: {
          categoria_id: string | null
          cliente_id: string | null
          created_at: string
          descricao: string
          documento: string | null
          fornecedor_id: string | null
          id: string
          metodo: Database["public"]["Enums"]["pagamento_metodo"] | null
          observacoes: string | null
          pago_em: string | null
          status: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at: string
          user_id: string | null
          valor: number
          vencimento: string
        }
        Insert: {
          categoria_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao: string
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["pagamento_metodo"] | null
          observacoes?: string | null
          pago_em?: string | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          user_id?: string | null
          valor?: number
          vencimento?: string
        }
        Update: {
          categoria_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao?: string
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["pagamento_metodo"] | null
          observacoes?: string | null
          pago_em?: string | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo?: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          user_id?: string | null
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_itens: {
        Row: {
          adiantamentos: number
          atrasos: number
          bonus: number
          cargo: string | null
          codigo: string | null
          created_at: string
          departamento: string | null
          desconto_faltas: number
          dias_presentes: number
          estabelecimento: string | null
          faltas_injustificadas: number
          faltas_justificadas: number
          folha_id: string
          funcionario_id: string
          horas_extra: number
          id: string
          lancamento_id: string | null
          liquido: number
          metodo_pagamento:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          nome_funcionario: string
          observacoes: string | null
          outros_descontos: number
          pago_em: string | null
          referencia_pagamento: string | null
          salario_base: number
          status_pagamento: string
          subsidios: number
          updated_at: string
          valor_dia: number
          valor_horas_extra: number
        }
        Insert: {
          adiantamentos?: number
          atrasos?: number
          bonus?: number
          cargo?: string | null
          codigo?: string | null
          created_at?: string
          departamento?: string | null
          desconto_faltas?: number
          dias_presentes?: number
          estabelecimento?: string | null
          faltas_injustificadas?: number
          faltas_justificadas?: number
          folha_id: string
          funcionario_id: string
          horas_extra?: number
          id?: string
          lancamento_id?: string | null
          liquido?: number
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          nome_funcionario: string
          observacoes?: string | null
          outros_descontos?: number
          pago_em?: string | null
          referencia_pagamento?: string | null
          salario_base?: number
          status_pagamento?: string
          subsidios?: number
          updated_at?: string
          valor_dia?: number
          valor_horas_extra?: number
        }
        Update: {
          adiantamentos?: number
          atrasos?: number
          bonus?: number
          cargo?: string | null
          codigo?: string | null
          created_at?: string
          departamento?: string | null
          desconto_faltas?: number
          dias_presentes?: number
          estabelecimento?: string | null
          faltas_injustificadas?: number
          faltas_justificadas?: number
          folha_id?: string
          funcionario_id?: string
          horas_extra?: number
          id?: string
          lancamento_id?: string | null
          liquido?: number
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          nome_funcionario?: string
          observacoes?: string | null
          outros_descontos?: number
          pago_em?: string | null
          referencia_pagamento?: string | null
          salario_base?: number
          status_pagamento?: string
          subsidios?: number
          updated_at?: string
          valor_dia?: number
          valor_horas_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_itens_folha_id_fkey"
            columns: ["folha_id"]
            isOneToOne: false
            referencedRelation: "folhas_salariais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      folhas_salariais: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          created_at: string
          dias_base: number
          fechada_em: string | null
          fechada_por: string | null
          id: string
          mes: string
          observacoes: string | null
          status: Database["public"]["Enums"]["folha_status"]
          total_base: number
          total_descontos: number
          total_extras: number
          total_liquido: number
          total_subsidios: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          created_at?: string
          dias_base?: number
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["folha_status"]
          total_base?: number
          total_descontos?: number
          total_extras?: number
          total_liquido?: number
          total_subsidios?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          created_at?: string
          dias_base?: number
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["folha_status"]
          total_base?: number
          total_descontos?: number
          total_extras?: number
          total_liquido?: number
          total_subsidios?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          contacto: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          morada: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          morada?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          morada?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      funcionario_salario_historico: {
        Row: {
          bonus_anterior: number | null
          bonus_novo: number | null
          created_at: string
          funcionario_id: string
          id: string
          motivo: string | null
          salario_anterior: number | null
          salario_novo: number | null
          subsidios_anterior: number | null
          subsidios_novo: number | null
          user_id: string | null
        }
        Insert: {
          bonus_anterior?: number | null
          bonus_novo?: number | null
          created_at?: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          subsidios_anterior?: number | null
          subsidios_novo?: number | null
          user_id?: string | null
        }
        Update: {
          bonus_anterior?: number | null
          bonus_novo?: number | null
          created_at?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          subsidios_anterior?: number | null
          subsidios_novo?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_salario_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          admitido_em: string | null
          bonus: number
          cargo: string | null
          codigo: string | null
          created_at: string
          departamento: string | null
          desconta_faltas: boolean
          desconto_percent: number
          documento: string | null
          email: string | null
          estabelecimento: string | null
          foto_url: string | null
          id: string
          is_active: boolean
          jornada: string | null
          metodo_pagamento:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          morada: string | null
          nome: string
          notas: string | null
          outros_descontos: number
          saiu_em: string | null
          salario_base: number
          subsidios: number
          telefone: string | null
          tipo_contrato: string | null
          turno: string | null
          updated_at: string
          valor_hora_extra: number
        }
        Insert: {
          admitido_em?: string | null
          bonus?: number
          cargo?: string | null
          codigo?: string | null
          created_at?: string
          departamento?: string | null
          desconta_faltas?: boolean
          desconto_percent?: number
          documento?: string | null
          email?: string | null
          estabelecimento?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          jornada?: string | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          morada?: string | null
          nome: string
          notas?: string | null
          outros_descontos?: number
          saiu_em?: string | null
          salario_base?: number
          subsidios?: number
          telefone?: string | null
          tipo_contrato?: string | null
          turno?: string | null
          updated_at?: string
          valor_hora_extra?: number
        }
        Update: {
          admitido_em?: string | null
          bonus?: number
          cargo?: string | null
          codigo?: string | null
          created_at?: string
          departamento?: string | null
          desconta_faltas?: boolean
          desconto_percent?: number
          documento?: string | null
          email?: string | null
          estabelecimento?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          jornada?: string | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          morada?: string | null
          nome?: string
          notas?: string | null
          outros_descontos?: number
          saiu_em?: string | null
          salario_base?: number
          subsidios?: number
          telefone?: string | null
          tipo_contrato?: string | null
          turno?: string | null
          updated_at?: string
          valor_hora_extra?: number
        }
        Relationships: []
      }
      movimentos_estoque: {
        Row: {
          created_at: string
          estoque_anterior: number
          estoque_novo: number
          id: string
          motivo: string | null
          produto_id: string
          quantidade: number
          referencia: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estoque_anterior: number
          estoque_novo: number
          id?: string
          motivo?: string | null
          produto_id: string
          quantidade: number
          referencia?: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estoque_anterior?: number
          estoque_novo?: number
          id?: string
          motivo?: string | null
          produto_id?: string
          quantidade?: number
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["movimento_tipo"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          data: string
          estado: Database["public"]["Enums"]["presenca_estado"]
          funcionario_id: string
          horas: number
          horas_extra: number
          id: string
          justificacao: string | null
          justificacao_estado: string | null
          minutos_atraso: number
          observacoes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data?: string
          estado?: Database["public"]["Enums"]["presenca_estado"]
          funcionario_id: string
          horas?: number
          horas_extra?: number
          id?: string
          justificacao?: string | null
          justificacao_estado?: string | null
          minutos_atraso?: number
          observacoes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data?: string
          estado?: Database["public"]["Enums"]["presenca_estado"]
          funcionario_id?: string
          horas?: number
          horas_extra?: number
          id?: string
          justificacao?: string | null
          justificacao_estado?: string | null
          minutos_atraso?: number
          observacoes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria_id: string | null
          codigo: string | null
          codigo_barras: string | null
          created_at: string
          descricao: string | null
          estoque_atual: number
          estoque_minimo: number
          fornecedor_id: string | null
          foto_url: string | null
          id: string
          is_active: boolean
          lucro: number | null
          nome: string
          preco_compra: number
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          lucro?: number | null
          nome: string
          preco_compra?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          lucro?: number | null
          nome?: string
          preco_compra?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          position: string | null
          shift: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          position?: string | null
          shift?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          position?: string | null
          shift?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          created_at: string
          desconto: number
          id: string
          nome_produto: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          desconto?: number
          id?: string
          nome_produto: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          created_at?: string
          desconto?: number
          id?: string
          nome_produto?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_pagamentos: {
        Row: {
          created_at: string
          id: string
          metodo: Database["public"]["Enums"]["pagamento_metodo"]
          referencia: string | null
          valor: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metodo: Database["public"]["Enums"]["pagamento_metodo"]
          referencia?: string | null
          valor: number
          venda_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metodo?: Database["public"]["Enums"]["pagamento_metodo"]
          referencia?: string | null
          valor?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          acrescimo: number
          cancelada_em: string | null
          cliente_id: string | null
          created_at: string
          desconto: number
          id: string
          mesa: string | null
          metodo_pagamento:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          numero: number
          observacoes: string | null
          paga_em: string | null
          status: Database["public"]["Enums"]["venda_status"]
          subtotal: number
          tipo: Database["public"]["Enums"]["venda_tipo"]
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acrescimo?: number
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          id?: string
          mesa?: string | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          numero?: number
          observacoes?: string | null
          paga_em?: string | null
          status?: Database["public"]["Enums"]["venda_status"]
          subtotal?: number
          tipo?: Database["public"]["Enums"]["venda_tipo"]
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acrescimo?: number
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          id?: string
          mesa?: string | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["pagamento_metodo"]
            | null
          numero?: number
          observacoes?: string | null
          paga_em?: string | null
          status?: Database["public"]["Enums"]["venda_status"]
          subtotal?: number
          tipo?: Database["public"]["Enums"]["venda_tipo"]
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancelar_fatura: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      converter_cotacao: {
        Args: { p_destino: string; p_id: string }
        Returns: string
      }
      corrigir_instalacao: {
        Args: never
        Returns: {
          accao: string
          resultado: string
        }[]
      }
      doc_pode: { Args: { _acao: string }; Returns: boolean }
      emitir_fatura: { Args: { p_id: string }; Returns: undefined }
      gerar_folha: { Args: { p_mes: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      proximo_numero_documento: {
        Args: { _serie: string; _tipo: string }
        Returns: string
      }
      verificar_instalacao: {
        Args: never
        Returns: {
          detalhe: string
          status: string
          verificacao: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "supervisor"
        | "caixa"
        | "garcom"
        | "cozinha"
        | "estoque"
      caixa_movimento_tipo: "entrada" | "saida" | "sangria" | "reforco"
      caixa_status: "aberta" | "fechada"
      compra_status: "rascunho" | "pendente" | "recebida" | "cancelada"
      cotacao_status:
        | "rascunho"
        | "enviada"
        | "aceite"
        | "recusada"
        | "expirada"
        | "convertida"
        | "cancelada"
      fatura_status:
        | "rascunho"
        | "emitida"
        | "parcial"
        | "paga"
        | "vencida"
        | "cancelada"
      financeiro_status: "pendente" | "pago" | "cancelado"
      financeiro_tipo: "receita" | "despesa"
      folha_status: "rascunho" | "aprovada" | "fechada" | "paga"
      movimento_tipo:
        | "compra"
        | "venda"
        | "ajuste"
        | "transferencia_entrada"
        | "transferencia_saida"
      pagamento_metodo:
        | "dinheiro"
        | "mpesa"
        | "emola"
        | "pos"
        | "transferencia"
        | "misto"
      presenca_estado:
        | "presente"
        | "falta"
        | "falta_justificada"
        | "ferias"
        | "folga"
        | "meio_periodo"
        | "atraso"
        | "licenca"
      venda_status: "aberta" | "paga" | "cancelada"
      venda_tipo: "balcao" | "mesa" | "delivery"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gerente",
        "supervisor",
        "caixa",
        "garcom",
        "cozinha",
        "estoque",
      ],
      caixa_movimento_tipo: ["entrada", "saida", "sangria", "reforco"],
      caixa_status: ["aberta", "fechada"],
      compra_status: ["rascunho", "pendente", "recebida", "cancelada"],
      cotacao_status: [
        "rascunho",
        "enviada",
        "aceite",
        "recusada",
        "expirada",
        "convertida",
        "cancelada",
      ],
      fatura_status: [
        "rascunho",
        "emitida",
        "parcial",
        "paga",
        "vencida",
        "cancelada",
      ],
      financeiro_status: ["pendente", "pago", "cancelado"],
      financeiro_tipo: ["receita", "despesa"],
      folha_status: ["rascunho", "aprovada", "fechada", "paga"],
      movimento_tipo: [
        "compra",
        "venda",
        "ajuste",
        "transferencia_entrada",
        "transferencia_saida",
      ],
      pagamento_metodo: [
        "dinheiro",
        "mpesa",
        "emola",
        "pos",
        "transferencia",
        "misto",
      ],
      presenca_estado: [
        "presente",
        "falta",
        "falta_justificada",
        "ferias",
        "folga",
        "meio_periodo",
        "atraso",
        "licenca",
      ],
      venda_status: ["aberta", "paga", "cancelada"],
      venda_tipo: ["balcao", "mesa", "delivery"],
    },
  },
} as const
