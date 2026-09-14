# Relatórios gerenciais EKsteel

Acesse Dashboard → Relatórios. O mês selecionado inclui a janela de 12 meses encerrada nele. No mês atual, a apuração vai até hoje (America/Sao_Paulo); o mês anterior usa os mesmos dias decorridos, limitado ao seu último dia.

## Fórmulas

- Receita bruta = quantidade comercial × preço unitário, arredondada por lançamento.
- Vendas após descontos = receita bruta − descontos.
- Receita líquida gerencial = receita bruta − descontos − taxas de marketplace. É complementar e não comprova recebimento.
- **CMV** = custo das mercadorias vendidas, gravado pelo custo médio ao registrar a venda. Reposição considera saldo e custo anterior mais custo de aquisição recebido. Não depende de pedido de fabricação.
- Lucro bruto estimado = vendas após descontos − CMV.
- Lucro líquido gerencial estimado = lucro bruto − taxas de marketplace − despesas registradas. Não é lucro líquido contábil nem EBITDA.
- Margens = resultados ÷ vendas após descontos. Receita zero não gera margem.

Vendas antigas usam custo cadastral estimado, congelado pela migração. Os relatórios mostram quantas vendas usam estimativas. Sem custo positivo ou composição conhecida, CMV/resultado permanecem não apurados; custo desconhecido não é zero. [Detalhes da implantação e do fluxo de reposição](cmv-ecommerce.md).

## Estoque e vendas

Estoque usa saldo cadastrado e custo médio de reposição; saldo inicial/custo cadastral estimado fica identificado. Não é reconstruído de históricos incompletos. Produtos inativos com saldo são incluídos.

Kits contam uma unidade comercial no ranking, sem duplicar receita nos componentes. As saídas físicas seguem a composição gravada na venda; no legado, a composição conhecida. ABC usa receita positiva após descontos: A inclui o item que cruza 80%, B o que cruza 95%, C restante. A ordenação é por quantidade. Cobertura = saldo ÷ média diária de saídas na janela atual de 12 meses; não é previsão sazonal.

Compras recebidas entram no resultado via CMV, não pelo custo de todas as unidades compradas. Taxas também lançadas em despesas são sinalizadas, sem presumir deduplicação. Rateios de sócios não são balancete contábil.

## Posição patrimonial parcial

Somente estoque de produtos pode ser estimado. Caixa, bancos, contas a receber/pagar, tributos, empréstimos, imobilizado e patrimônio líquido exigem registros e conciliação próprios. Não são inferidos de pedidos nem de rateios.

## Leitura e validação

Consultas paginadas respeitam as permissões da conta. Falhas bloqueiam totais parciais. Leituras paginadas não são snapshots transacionais. O CSV inclui períodos e origem estimada dos custos; textos com risco de fórmula são escapados.

`npm run test:relatorios` verifica cálculos e períodos. `node scripts/testar-cmv-ecommerce.mjs` verifica reposição, estoque e CMV em PostgreSQL descartável. Valide também TypeScript e build. Cancelamentos, devoluções, competência e liquidação devem ser conciliados na origem.
