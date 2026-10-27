# Requisitos funcionais e de segurança — INDICO GROUP
## Recursos humanos, folha salarial, perfis, IVA, relatórios e dispositivos
Estado: especificação de implementação; os pontos abaixo não devem ser considerados implementados apenas por estarem documentados.

## 1. Princípios obrigatórios
- A base de dados é a fonte de verdade. Validações críticas não podem existir apenas no navegador.
- Operações financeiras, fiscais, salariais, de stock e permissões devem ser executadas por funções transaccionais/RPC com validação e auditoria.
- Não inventar valores, nomes, documentos, presenças, taxas ou movimentos para preencher lacunas. Campos obrigatórios em falta devem bloquear a operação e explicar o que falta.
- Operações críticas devem ser idempotentes, impedir duplicações e registar autor, data, motivo e alterações relevantes.
- Não apagar movimentos contabilísticos ou de stock já confirmados; corrigir através de estorno auditado.
- Preparar o sistema para smartphone, tablet e computador, com layouts responsivos e acessibilidade por teclado/toque.

## 2. Funcionários e perfis de acesso
O administrador principal tem controlo total: gerir utilizadores, funcionários, permissões, estabelecimentos, configurações, integrações e auditoria. O acesso total deve ser atribuído explicitamente e protegido; nenhum utilizador deve poder elevar a própria função.
Perfis base configuráveis:
- Administrador
- Gerente
- Coordenador
- Supervisor
- Caixa
- Contabilidade/Auditoria
- Garçom
- Cozinha/Cozinheiro
- Alojamento/Recepção
- Segurança
- Limpeza
- Eletricista/Manutenção
- Canalizador/Manutenção
- DJ/Entretenimento
- RH/Processamento salarial
Os perfis são modelos de permissões, não apenas rótulos. Deve ser possível ajustar permissões por módulo e acção (consultar, criar, editar, aprovar, pagar, cancelar, exportar, configurar). Separar criação/preparação de aprovação/pagamento quando possível. Aplicar autorização no servidor e RLS em todas as tabelas sensíveis; ocultar botões na interface não é segurança suficiente.

## 3. Cadastro e validação de funcionários
- Código interno único, nome legal, contacto, cargo, departamento, estabelecimento, turno/jornada, tipo de contrato, datas de admissão/saída e estado.
- Dados de identificação estritamente necessários, validade quando aplicável, foto e contacto de emergência conforme política interna.
- Salário, subsídios, bónus, valor de hora extra, método de pagamento e histórico salarial com motivo e autor.
- Validar campos obrigatórios, formatos, limites numéricos, duplicação de código/documento e datas incoerentes. Não usar dados de exemplo em produção.
- Dados pessoais e salariais só são visíveis para funções autorizadas; registar acessos e alterações relevantes.
- Cartão de funcionário imprimível com código/QR opcional, sem expor número completo de documento de identidade.

## 4. Assiduidade
- Registo por funcionário, data, turno, hora de entrada/saída, intervalo, atraso em minutos, horas normais e extraordinárias, estado e justificação.
- Estados controlados: presente, falta, falta justificada, atraso, licença, férias, folga e meio período, com regras coerentes.
- Impedir registos duplicados incompatíveis para a mesma pessoa/turno; validar que datas não são futuras (salvo escalas) e que saída é posterior à entrada.
- Alterações retroactivas e justificações exigem motivo e deixam trilho de auditoria. A aprovação de faltas/horas extra deve ser configurável.
- Não tratar automaticamente dias sem registo como presença confirmada. A folha deve identificar assiduidade incompleta e bloquear aprovação até revisão, salvo excepção autorizada e auditada.
- Relatórios de turno/dia devem identificar funcionário(s) efectivamente escalados e quem registou/aprovou a informação.

## 5. Ciclo da folha salarial
Estados propostos: Rascunho → Em revisão → Submetida → Aprovada → Fechada → Paga. Reabertura apenas por administrador autorizado, com motivo e auditoria.
1. Gerar a folha do mês a partir de funcionários activos, contrato e salário aplicável ao período.
2. Congelar uma fotografia dos valores usados: salário base, subsídios, bónus, assiduidade aprovada, horas extra aprovadas, adiantamentos/empréstimos e descontos autorizados.
3. Apresentar alertas de faltas sem justificação, assiduidade incompleta, salários ausentes, duplicações e valores fora dos limites configurados.
4. Revisão por RH/contabilidade; aprovação por gerente/administrador autorizado conforme política.
5. Depois de aprovada/fechada, bloquear edição directa dos itens. Correcções através de reabertura autorizada ou ajuste auditado.
6. Pagamento idempotente: não criar duas despesas/pagamentos para o mesmo item salarial. O registo financeiro e o estado salarial devem ser atómicos no servidor.
7. Emitir recibo individual/comprovativo interno com funcionário, mês, discriminação de bruto, subsídios, horas extra, descontos, dívida/adiantamento descontado, líquido, método, referência, data, emissor e espaço para assinatura do trabalhador.
8. O pagamento só muda para pago depois da confirmação persistida; erros parciais devem poder ser recuperados sem duplicar movimentos.
9. O cálculo deve seguir regras laborais e fiscais aplicáveis confirmadas pela empresa/contabilista. Não assumir que uma regra de dias-base serve para todos os contratos.

## 6. IVA de 16% e documentos fiscais
- Configurar a taxa padrão de IVA a 16%, com tratamento explícito de preços com IVA incluído ou acrescido, arredondamento consistente e discriminação de base tributável, taxa, IVA e total.
- A aplicação da taxa deve respeitar a natureza da operação, isenções, regras fiscais vigentes e requisitos legais do documento. Não aplicar IVA automaticamente a salários, empréstimos ou movimentos que não sejam vendas tributáveis.
- Recibos, facturas e relatórios fiscais devem indicar NUIT/dados da empresa, número sequencial, datas, itens/quantidades, preço, base tributável, IVA, total, valores pagos e saldo, conforme aplicável.
- Nunca inventar NUIT, dados fiscais, número de documento, cliente ou taxa. Se dados legalmente obrigatórios estiverem em falta, avisar e bloquear a emissão fiscal definitiva; permitir apenas rascunho claramente marcado.
- Confirmar junto de contabilista/autoridade tributária as regras e os requisitos de facturação aplicáveis antes de declarar documentos como fiscalmente válidos.

## 7. Relatórios e inventários por módulo
Todos os relatórios devem aceitar período diário, semanal, mensal, semestral, anual e intervalo personalizado; mostrar filtros, data/hora de geração, estabelecimento, totais, estado e utilizador responsável.
- Bar/vendas: vendas pagas, anuladas, descontos, IVA, formas de pagamento, caixa, funcionário em serviço e reconciliação.
- Cozinha: pedidos/itens recebidos, em preparação, prontos e entregues; tempos e funcionário responsável, se esses eventos forem registados.
- Alojamento: ocupação, reservas, check-in/check-out, diárias, consumos, pagamentos, IVA aplicável e saldos.
- Stock: saldo inicial, entradas, saídas, transferências, ajustes, saldo final, custo, mínimos e movimentos de cada período.
- Compras: ordens, fornecedor, recepção, devoluções, IVA suportado quando aplicável e valores pendentes.
- Finanças: receitas, despesas, saídas, caixa, dívidas a pagar/receber, empréstimos, prestações, juros se aplicáveis e saldos iniciais/finais.
- RH: escala e funcionários em serviço por dia/turno, presenças, atrasos, faltas, horas extra, folha gerada/aprovada/paga e descontos.
- Todos os relatórios devem oferecer pré-visualização, PDF, impressão e exportação tabular quando útil. Não mostrar o nome de um funcionário como estando de serviço sem escala ou registo confirmado; quando faltar a informação, apresentar “não registado”.

## 8. Segurança, integridade e privacidade
- Rever todas as políticas RLS, funções SECURITY DEFINER, permissões de tabelas, RPCs, armazenamento e regras de acesso.
- Menor privilégio por defeito; autenticação robusta, recuperação de conta segura, encerramento de sessões e protecção contra elevação de privilégios.
- Não guardar segredos no repositório; usar variáveis de ambiente e rotação se alguma chave sensível tiver sido exposta. Chaves públicas Supabase continuam dependentes de RLS correcta.
- Restringir uploads por tipo/tamanho, validar ficheiros e limitar acesso a fotos/documentos.
- Registar operações críticas em auditoria imutável para utilizadores comuns; proteger os logs de alterações indevidas.
- Validar no servidor quantidades, preços, totais, IVA, descontos, permissões, datas, transições de estado e saldos. Nunca confiar em totais calculados apenas no cliente.
- Testar tentativas de acesso cruzado entre funções, repetição de pedidos, concorrência, falhas parciais, dados inválidos e acessos não autenticados.

## 9. Extensibilidade para administrador/desenvolvedor
- Área administrativa de extensões/integradores, acessível apenas a administradores autorizados.
- Catálogo de módulos, estado, versão, dependências e permissões solicitadas; activar/desactivar com migração validada e registo de auditoria.
- Não permitir executar código arbitrário nem editar SQL de produção directamente pela interface. Integrações devem usar APIs documentadas, tokens com escopos mínimos, segredos guardados fora do browser e processo de aprovação.
- Novos módulos devem integrar navegação, permissões, auditoria, relatórios, configurações e testes automatizados.

## 10. Compatibilidade e critérios de aceitação
- Interface responsiva e testada em Android, iPhone/iOS, tablet e computador, incluindo ecrãs pequenos, teclado virtual, impressão e leitura de PDFs.
- Testes de unidade para cálculos; testes de integração para folha/pagamentos/IVA/stock; testes de permissões/RLS; testes ponta-a-ponta dos fluxos críticos.
- Executar build, lint, typecheck e testes antes de integrar na branch principal.
- Fazer migrações reversíveis/seguras, cópia de segurança e validação em ambiente de teste antes de produção.
- Não marcar qualquer área como concluída sem evidência de teste e verificação com dados reais autorizados.
