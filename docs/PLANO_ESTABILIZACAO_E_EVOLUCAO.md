# Plano de estabilização e evolução — INDICO GROUP

## Objectivo
Transformar o INDICO GROUP num sistema integrado de gestão comercial, alojamento, stock, finanças e recursos humanos. Este documento é o plano de execução e validação; não significa que todas as funcionalidades já estejam implementadas ou testadas.

## Regras transversais obrigatórias
1. A base de dados é a fonte de verdade; não calcular saldos financeiros independentes em cada ecrã.
2. Cada operação financeira/stock deve ter registo, utilizador, data, referência e estado.
3. Operações críticas devem ser atómicas no servidor (funções SQL/RPC ou transacções), evitando venda gravada sem itens, salário pago sem comprovativo ou stock actualizado parcialmente.
4. Não apagar movimentos financeiros/stock confirmados: corrigir por estorno auditado.
5. Respeitar permissões/RLS no servidor, não apenas esconder botões.
6. Valores monetários devem usar precisão decimal e moeda configurada; evitar cálculos financeiros com arredondamentos inconsistentes.
7. Relatórios devem partilhar filtros de período, unidade (quando existir), estado e fonte de dados; indicar hora de actualização.
8. Não aplicar migrações destrutivas nem alterar a base de dados de produção sem revisão, backup e validação do esquema real.

## Fase 0 — Inventário técnico e segurança
- [ ] Mapear tabelas, chaves estrangeiras, índices, políticas RLS, triggers e funções SQL existentes.
- [ ] Verificar dependências e build/typecheck/lint; corrigir erros antes de ampliar funcionalidades.
- [ ] Confirmar configuração Supabase e remover ficheiros .env de qualquer branch público; manter apenas placeholders e variáveis no ambiente de deploy.
- [ ] Verificar segredos expostos no histórico Git e rodar credenciais privilegiadas se necessário.
- [ ] Definir testes de aceitação por fluxo e preservar a branch principal.

## Fase 1 — Vendas, comandas, cozinha e mesas
- [ ] Uma única comanda aberta por mesa, com controlo contra duplicação concorrente.
- [ ] Criar/actualizar comanda sem a marcar paga; adicionar/remover itens com auditoria e recálculo consistente.
- [ ] Enviar itens para cozinha, acompanhar estados e manter a ligação ao pedido original.
- [ ] Fechar comanda apenas após registar pagamento(s); suportar métodos mistos e referências.
- [ ] Descontar stock uma única vez, num evento confirmado; impedir stock negativo também no servidor.
- [ ] Recibo PDF e impressão para cada venda, com número, empresa, itens, quantidades, preços, descontos, total, pagamentos, troco quando aplicável e data.
- [ ] Testar falhas intermédias, repetição de cliques, pagamento duplicado, cancelamentos e devoluções.

## Fase 2 — Alojamento
- [ ] Fluxo completo de reserva, check-in, extensão, consumos, check-out, cancelamento e estado de quartos.
- [ ] Evitar reservas sobrepostas para o mesmo quarto e datas incompatíveis.
- [ ] Integrar consumos do bar/restaurante na conta do hóspede, sem duplicar vendas nem stock.
- [ ] Fecho de conta com discriminação de noites, tarifas, extras, descontos e pagamentos.
- [ ] Recibo PDF e impressão a partir da conta/estadia e histórico pesquisável.
- [ ] Relatórios de ocupação, receita por quarto/período, estadias activas, cancelamentos e saldos pendentes.

## Fase 3 — Stock, compras e fornecedores
- [ ] Recepção de compras gera movimentos de entrada; rascunhos/canceladas não alteram stock.
- [ ] Vendas pagas/confirmadas e consumos autorizados geram saídas únicas; devoluções geram movimentos inversos rastreáveis.
- [ ] Ajustes, perdas, transferências e inventário físico exigem motivo e utilizador.
- [ ] Alertas de mínimo, custo médio e valorização consistentes.
- [ ] Livro de movimentos por produto e reconciliação entre saldo calculado e saldo actual.
- [ ] Relatórios de compras, vendas, margens, perdas, stock baixo e valorização.

## Fase 4 — Recursos Humanos e salários
- [ ] Cadastro de funcionário com identificação, contactos, dados profissionais, contactos de emergência, foto, documentos e estado contratual; limitar acesso a dados pessoais.
- [ ] Validar campos e evitar expor documentos/fotos publicamente; usar storage privado e políticas de acesso.
- [ ] Gerar cartão/crachá com foto, nome, função, número interno e validade; PDF pronto para imprimir.
- [ ] Folha salarial calcula salário base, assiduidade, faltas, horas extras, subsídios, descontos legais configuráveis, adiantamentos e dívida do funcionário.
- [ ] Campo para desconto mensal de empréstimo/dívida, com saldo inicial, movimentos, parcela descontada e saldo remanescente. Impedir desconto superior ao saldo ou ao limite permitido configurado.
- [ ] Ligar presenças aprovadas ao cálculo, com regras visíveis e possibilidade de revisão antes do fecho.
- [ ] Fechar folha com snapshot dos valores calculados e trilho de auditoria; alterações posteriores requerem reabertura autorizada.
- [ ] Registar pagamento de cada funcionário por método/data/referência; não permitir pagamento duplicado.
- [ ] Emitir comprovativo/recibo salarial interno em PDF, com período, rubricas, descontos, líquido, método de pagamento e espaço de assinatura do funcionário e responsável.
- [ ] Dashboard RH com efectivos activos, assiduidade, faltas, atrasos, horas extras, massa salarial, salários pagos/pendentes, dívidas e tendências por período.
- [ ] Testar meses com faltas, admissões/desligamentos, salários parciais, adiantamentos e correcções.

## Fase 5 — Finanças, caixa, despesas e dívidas
- [ ] Ligar cada venda, compra, despesa, pagamento salarial, recebimento de alojamento e empréstimo ao livro financeiro correspondente.
- [ ] Distinguir fluxo de caixa de receita/despesa contabilística e evitar contabilização duplicada.
- [ ] Controlar caixa por sessão, abertura, movimentos, fecho, diferença e utilizador.
- [ ] Registar empréstimos/dívidas de funcionários e terceiros com origem, saldo, prestações, pagamentos e comprovativos.
- [ ] Auditoria para estornos, descontos, cancelamentos e alterações críticas.

## Fase 6 — Relatórios e dashboards
- [ ] Relatórios por período para vendas, produtos, cozinha, alojamento, compras, stock, despesas, caixa, salários, dívidas, devoluções e auditoria.
- [ ] Totais reconciliados com registos de origem, filtros claros, exportação PDF/CSV e impressão.
- [ ] Dashboards actualizados por invalidation React Query e/ou subscrições Supabase quando adequado; mostrar estados de carregamento, erro e última actualização.
- [ ] Não usar dados de demonstração para apresentar resultados como reais.

## Fase 7 — Experiência premium e acessibilidade
- [ ] Sistema visual consistente: hierarquia tipográfica, espaçamento, grelha, cores de estado, tabelas legíveis e formulários agrupados.
- [ ] Login responsivo e moderno, com estados de carregamento/erro, mostrar/ocultar senha, acessibilidade e sem promessas falsas de segurança.
- [ ] Optimizar uso em computador, tablet e telemóvel; estados vazios, confirmação para acções irreversíveis e feedback de sucesso/erro.
- [ ] Manter linguagem uniforme em português e formatos de data/moeda configuráveis.

## Critérios de aceitação para qualquer módulo
- [ ] Build e TypeScript sem erros.
- [ ] Permissões e políticas de acesso verificadas.
- [ ] Testes de fluxo normal, erro de rede, dados inválidos, repetição e concorrência.
- [ ] PDF aberto e impressão testada em formato real.
- [ ] Reconciliação de totais e movimentos antes/depois.
- [ ] Revisão em ecrãs pequenos e grandes.
- [ ] Migração reversível ou plano de recuperação documentado.
- [ ] Nenhuma mudança publicada em produção sem validação explícita.

## Ordem recomendada
1. Inventário técnico, build e segurança.
2. Integridade de vendas/comandas/stock.
3. Recibos de venda e alojamento.
4. Compras, despesas e reconciliação financeira.
5. Cadastro RH, assiduidade, dívida e folha salarial.
6. Recibos internos de salários e crachá.
7. Dashboards e relatórios integrados.
8. Polimento visual e testes ponta a ponta.

## Estado
Planeamento inicial criado na branch de desenvolvimento. Cada item deve ser marcado concluído somente depois de alteração de código, revisão e testes verificáveis.
