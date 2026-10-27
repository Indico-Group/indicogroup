# Auditoria técnica inicial — INDICO GROUP

Data da revisão: 2026-10-27
Branch: `feature/comandas-mesas-abertas`

## Âmbito e limites
Revisão estática dos ficheiros do repositório. Não houve ligação directa à base de dados Supabase, execução local do projecto, testes automatizados nem verificação de políticas/triggers em produção. As observações abaixo são riscos visíveis no código, não uma certificação de todos os comportamentos do sistema.

## Achados prioritários

### P0 — Configuração de ambiente versionada
- Foi encontrado um ficheiro `.env` versionado na raiz do repositório.
- Acção recomendada: verificar o conteúdo e o histórico do Git; retirar ficheiros de ambiente do controlo de versões, adicionar placeholders documentados e confirmar que as variáveis estão configuradas no ambiente de deploy.
- Se algum segredo privilegiado tiver sido exposto, revogar/rodar esse segredo. Não publicar valores de chaves no relatório. Chaves anon/publishable não equivalem a service-role, mas continuam a exigir políticas RLS correctas.

### P1 — Fluxo de venda não atómico no cliente
Ficheiro: `src/routes/_authenticated/vendas.tsx`
- O fluxo faz inserções sequenciais no browser: cria a venda como aberta, insere itens, insere pagamento e depois muda o estado para paga.
- Se uma etapa intermédia falhar, pode deixar registos incompletos; se o utilizador repetir a operação, pode haver duplicação. A interface não consegue garantir transacção SQL entre chamadas independentes.
- O stock parece depender de um trigger ao mudar para paga, mas esse trigger e a sua protecção contra repetição ainda precisam de ser inspeccionados na base de dados real.
- Correcção-alvo: uma função SQL/RPC transaccional, validando produtos/preços/quantidades, estado da venda, pagamento e stock no servidor, com prevenção de repetição e erros explícitos. Não criar essa função sem confirmar o esquema/triggers existentes.

### P1 — Mesas apenas mostram ocupação, sem fluxo de comanda
Ficheiro: `src/routes/_authenticated/mesas.tsx`
- A página consulta vendas abertas e calcula ocupação por texto do número da mesa, mas não apresenta uma acção completa para abrir uma comanda, adicionar itens à comanda existente ou fechar a conta.
- A consulta usa actualização periódica de 15 segundos, pelo que não é estritamente em tempo real.
- Pode mostrar várias vendas abertas para a mesma mesa; falta confirmar se existe uma restrição de unicidade na base de dados.
- Correcção-alvo: relacionar a mesa com uma comanda aberta única e permitir gerir itens e pagamento na mesma conta.

### P1 — Validação de stock só no estado da interface
Ficheiro: `src/routes/_authenticated/vendas.tsx`
- O carrinho verifica o stock mostrado no browser, mas esse valor pode estar desactualizado quando dois utilizadores vendem simultaneamente.
- Correcção-alvo: bloquear quantidades negativas/insuficientes no servidor, com transacção e controlo concorrente; actualizar o saldo apenas uma vez por operação confirmada.

### P2 — Recibos de venda já têm uma base reutilizável
Ficheiro: `src/lib/pdf.ts`
- Existem funções de criação de recibo PDF e de impressão, incluindo opções para talão térmico/A4.
- Ainda é necessário verificar se todas as vendas e todos os percursos (histórico, alojamento, devoluções e salários) têm acções acessíveis de emissão/impressão, e testar o resultado em impressoras reais.
- A função de impressão abre uma janela; se o navegador bloquear pop-ups, descarrega o PDF como alternativa. Isso deve ser testado nos dispositivos-alvo.

## Próxima sequência de execução
1. Rever todas as migrações existentes e localizar triggers/funções de stock e pagamentos.
2. Remover risco de configuração de ambiente versionada, sem perder a configuração necessária ao deploy.
3. Desenhar e implementar a operação transaccional de venda depois de confirmar as colunas e triggers existentes.
4. Ligar a página Mesas à comanda aberta e aos itens da venda, preservando compatibilidade com os dados actuais.
5. Testar venda de balcão, venda por mesa, pagamento, falha intermédia, repetição, stock insuficiente e duas vendas concorrentes.
6. Só depois prosseguir para alojamento e RH.

## Estado desta auditoria
- [x] Código das páginas de vendas e mesas lido.
- [x] Base de geração de recibos PDF localizada.
- [x] Riscos iniciais documentados.
- [ ] Esquema real Supabase e triggers confirmados.
- [ ] Build/typecheck e testes executados.
- [ ] Correcções funcionais implementadas e verificadas.
