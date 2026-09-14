# Compras, reposição e recuperação do CMV

A antiga aba Fabricação passa a se chamar **Compras / reposição**. Escolha compra de produto pronto e informe quantidade e custo total recebido (incluindo frete), ou detalhe os custos por componentes. Novas entradas atualizam o custo médio e estoque atomicamente. O histórico permanece na mesma tabela; a entrada associada de reposição não é contada novamente no estoque exibido.

## Aplicação no Supabase

Com a migração `cmv-ecommerce.sql` já aplicada, interrompa lançamentos e feche sessões antigas, gere `node scripts/gerar-unificacao-compras.mjs` e execute **supabase/local/unificar-compras-cmv.sql** no SQL Editor. Publique a aplicação atualizada antes de retomar os lançamentos. O SQL local é ignorado pelo Git e não foi executado automaticamente em produção.

## Por que havia CMV não calculado

A migração inicial congelou custos do cadastro. Quando eram nulos ou zero, as vendas ficaram com CMV ausente; alterar o cadastro depois não recalcula esses registros. Os valores já existentes em fabricação não eram usados nessa conciliação.

A atualização preenche custo médio ausente usando entradas históricas válidas. Para vendas sem CMV, preserva a composição congelada e procura custo unitário existente, média ponderada das entradas até a data da venda, custo cadastral ou custo médio disponível, nessa ordem. Quando só existe custo posterior, o resultado continua explicitamente estimado. Sem custo válido, permanece não calculado.

A conciliação não movimenta estoque, não cria reposições para compras antigas e não altera CMV já calculado. Marca as vendas recuperadas como estimadas e registra a data da conciliação. Não relance entradas antigas já incluídas no saldo.

## Validação

`node scripts/testar-unificacao-compras.mjs` usa PostgreSQL descartável para verificar reaplicação, preservação dos saldos e custos existentes, recuperação estimada, compras diretas e por componentes, reenvios sem duplicação, rollback e permissões.
