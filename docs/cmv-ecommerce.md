# CMV e reposição para e-commerce

## Fluxo diário

1. Em **Compras → Compras / reposição**, escolha o produto e registre quantidade recebida, custo total de aquisição e referência da compra. Distribua frete/custos de aquisição entre produtos antes de lançar. É uma entrada recebida agora, não um pedido pendente.
2. O sistema grava a entrada e aumenta o estoque na mesma transação. Custo médio = (saldo anterior × custo médio anterior + custo total recebido) ÷ saldo após entrada.
3. Ao registrar uma venda, o banco desconta as unidades e grava o CMV: quantidade × custo médio daquele lançamento. Reposições posteriores não recalculam a venda. Em kits, a composição e o custo de cada componente ficam gravados.
4. Relatórios e Visão Geral usam esse CMV para calcular resultados. Taxas de marketplace e despesas continuam deduzidas uma única vez.

Exemplo: 10 unidades de R$20 + 10 de R$30 → média R$25. Venda de 3 → CMV R$75. Compra posterior não muda esses R$75.

## Configuração inicial obrigatória

Não há acesso SQL de produção disponível pela chave REST. A aplicação exige a nova migração para registrar vendas/reposições com segurança.

1. Confira os saldos de estoque e os custos cadastrais antes da migração. Esses valores formarão o saldo inicial e a estimativa histórica.
2. Interrompa cadastros/edições de vendas e reposições e feche sessões antigas do sistema. A versão antiga movimentava estoque no navegador e não deve operar junto com o gatilho novo.
3. Gere o SQL com `node scripts/gerar-cmv-ecommerce.mjs` e execute `supabase/local/cmv-ecommerce.sql` no SQL Editor do Supabase. O arquivo fica ignorado pelo Git; o gerador contém apenas estrutura, sem credenciais.
4. Gere também `node scripts/gerar-unificacao-compras.mjs` e execute `supabase/local/unificar-compras-cmv.sql`. Se a migração anterior já foi aplicada, execute somente esta atualização.
5. Publique a nova versão e reabra o sistema atualizado. Não use clientes antigos para registrar vendas.

A migração congela o custo cadastral das vendas antigas como estimativa, sem alterar saldos de estoque. A atualização de unificação usa os custos das entradas antigas de fabricação para conciliar CMV ausente, como estimativa, sem duplicar entradas já presentes no saldo. Não relance compras antigas que já estão no estoque inicial.

## Histórico e limites

- **Estimado:** histórico anterior à migração, custo médio que ainda incorpora saldo inicial estimado ou venda registrada com data passada. A captura ocorre no momento do lançamento, não reconstrói cronologia desconhecida.
- **Sem custo:** custos ausentes/zerados ou composição indisponível continuam não apurados. Preencha e confira o cadastro antes de congelar o histórico. Corrigir custo cadastral depois não altera CMV já gravado; uma correção histórica exige conciliação controlada, sem reexecutar compras.
- Histórico sem migração usa custo cadastral atual como estimativa na tela. A migração é que congela esses valores.
- A composição de kits antigos é aquela disponível na migração; não há como recuperar composições que nunca foram registradas.
- Alterar preço/desconto/observação não altera CMV. Para corrigir produto, kit ou quantidade, exclua a venda e registre novamente. A exclusão estorna os componentes e seus custos gravados. Vendas históricas sem composição não são excluídas automaticamente.
- Estoque insuficiente bloqueia a venda em vez de ocultar saldo negativo. Reposição também bloqueia saldo negativo pendente de conciliação.
- Reposições são registros recebidos e imutáveis nesta versão. Não há edição, cancelamento ou devolução automática de compras. Correções exigem conciliação antes de novos lançamentos.
- A antiga Fabricação agora é **Compras / reposição**, com compra direta ou detalhamento por componentes. Pedidos de matéria-prima continuam separados. Compras integradas não podem ser editadas ou excluídas sem conciliação.
- O resultado permanece gerencial: tributos, competência e liquidação precisam ser conciliados. Não é fluxo de caixa nem demonstração contábil completa.

## Segurança e validação

Reposição exige usuário admin/sócio aprovado. A função registra quantidade, custo e estoque sob bloqueio do produto e recebe uma chave de tentativa para impedir duplicação em reenvios. Vendas mantêm a autorização da RLS existente; custo e estoque são gravados por gatilho com search_path fixo. O navegador não calcula ou grava o CMV definitivo.

Execute `node scripts/testar-cmv-ecommerce.mjs` com Docker para testar em PostgreSQL descartável. Execute `npm run test:relatorios` para testar a apuração gerencial, snapshots, kits e estimativas. Execute também `node scripts/testar-unificacao-compras.mjs` para validar conciliação e compras integradas. Nenhum teste acessa dados reais do Supabase.
