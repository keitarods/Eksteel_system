# Estoque por matéria-prima e atividades

O produto com composição usa matéria-prima como origem do saldo e baixa seus componentes **na venda**. O produto sem composição continua baixando produto acabado. Kits continuam sendo compostos por produtos; o cálculo soma os materiais compartilhados antes de dividir o saldo pela quantidade necessária. A disponibilidade de produtos diferentes não pode ser somada, pois eles podem disputar o mesmo material.

## Ativação

1. Aplique primeiro as migrações existentes `cmv-ecommerce.sql` e `unificar-compras-cmv.sql`, se ainda não estiverem aplicadas.
2. Interrompa lançamentos e feche sessões antigas durante a atualização. Execute `node scripts/gerar-estoque-materias-primas.mjs`.
3. Execute `supabase/local/estoque-materias-primas.sql` no SQL Editor do mesmo Supabase. O gerador é versionado; o SQL local segue ignorado pelo Git. A migração é reaplicável.
4. Publique a aplicação atualizada. Em Cadastro → Matérias-primas, escolha **Em caso de falta deste item**, tanto no cadastro quanto na edição. O padrão limita o saldo e gera alerta; a opção **Somente gerar alerta, sem limitar o saldo** pode ser usada em qualquer matéria-prima. A conciliação preserva essa escolha, sem classificar itens pelo nome.
5. Vincule cada componente do produto a uma matéria-prima e informe o consumo por unidade, na unidade cadastrada do material. Pelo menos um componente deve influenciar o saldo. Composição sem vínculo ou quantidade válida fica indisponível até ser corrigida.
6. Em Estoque → Matéria-prima → Movimentar / ajustar, informe a contagem inicial, a data e o motivo. Compras antigas não são importadas automaticamente para evitar duplicar estoque já consumido. Não relance pedidos antigos como novas entradas.

A migração não foi aplicada automaticamente em produção. A aplicação precisa desta estrutura antes de usar os novos recursos.

## Saldo e movimentações

- **Entrada / saída:** informa a quantidade movimentada. **Ajuste:** informa o saldo final contado. O banco calcula a diferença, bloqueia saldo negativo e rejeita ajuste feito sobre um saldo desatualizado.
- Toda movimentação de matéria-prima e ajuste manual de produto acabado registra quantidade, saldo após, data informada, instante do registro, motivo e usuário. O histórico é somente leitura para a aplicação.
- A data informada documenta o evento; um lançamento retroativo altera o saldo atual, sem refazer vendas ou saldos históricos. O instante de registro preserva a ordem efetiva das alterações.
- Não some saldo anterior de produto acabado à capacidade dos componentes. O saldo físico antigo permanece separado e aparece como aviso nos produtos compostos. Faça a conciliação do inventário ao adotar o modelo; não há conversão automática de acabados em matéria-prima.
- Produto sem composição aceita ajuste direto. Produto composto deve ser abastecido pelos seus materiais. Novas compras são exclusivamente de matérias-primas. As funções antigas de compra/reposição de produtos não ficam disponíveis para chamadas da aplicação.
- Os indicadores de disponibilidade na Visão Geral usam a composição. A avaliação financeira em Relatórios continua sendo a dos saldos físicos de produtos; ela não avalia o capital de matéria-prima nem soma a capacidade virtual ao estoque físico.

## Compras e vendas

Em Compras → Comprar matéria-prima, selecione os materiais, as quantidades nas unidades cadastradas e os preços unitários. Cada linha precisa de uma matéria-prima ativa e toda compra precisa de pelo menos uma linha. Ao salvar como **Recebido** (ou receber um pedido pendente), o banco grava documento, itens e entradas na mesma transação. Linhas avulsas sem vínculo e pedidos sem itens são recusados; despesas sem matéria-prima devem ser lançadas no fluxo de despesas. Pedidos pendentes/cancelados não geram entrada. Depois de integrado, os itens, o valor e a data ficam protegidos. Pedidos anteriores à migração são históricos e também ficam protegidos.

Cancelar um recebimento novo estorna a quantidade efetivamente recebida; o cancelamento é recusado se faltar saldo para o estorno. Um pedido integrado não pode ser recebido novamente ou excluído. Reenvios idênticos com a mesma chave não repetem a entrada. A divisão da compra no balancete mantém o fluxo existente, posterior ao recebimento.

A venda verifica e baixa os materiais limitadores. Se um item de apoio não tiver saldo suficiente, baixa apenas o disponível e grava a quantidade faltante no retrato da venda. A falta não reduz a capacidade, e pode ser consultada nos detalhes do estoque e da venda. O recebimento futuro não baixa automaticamente pendências de apoio antigas; registre a saída ao utilizá-lo.

Excluir uma venda estorna exatamente o material efetivamente baixado, mesmo que a composição tenha mudado. Vendas anteriores à migração preservam o estorno de produto acabado. O CMV permanece congelado em cada venda. Em novas vendas por matéria-prima, o custo de cada produto é a soma do consumo por unidade de todos os seus componentes multiplicado pelo custo médio de cada material, inclusive itens de apoio. Custos não lançados permanecem nulos nos itens e não bloqueiam a soma dos custos conhecidos; o total parcial é estimado. Sem nenhum custo conhecido, o CMV permanece não apurado; custo zero explicitamente informado é válido. Vendas anteriores não são recalculadas.

A aba Histórico de produtos mantém as compras/fabricações antigas somente para consulta. Uma correção de estoque deve ser registrada explicitamente com motivo.

## Atividades

A nova aba **Atividades** contém colunas A fazer, Em andamento e Concluído. Cadastre título, descrição, responsável e prazo; edite, exclua ou altere a etapa pelo seletor do cartão. As atividades são compartilhadas entre administradores e sócios e persistidas no Supabase, com usuário e instante de criação/atualização.

## Verificação

- `npm run test:estoque`: cálculo de produtos, kits compartilhando materiais, kits mistos, frações, composição incompleta e alertas não limitadores.
- `npm run test:estoque:db`: PostgreSQL 16 descartável via Docker; valida migração reaplicável, compras, vendas, estornos, snapshots, concorrência, ajustes, rollback, permissões e Kanban. Não acessa o Supabase de produção.
- `npx tsc --noEmit` e `npm run build`: integração da aplicação.

Após aplicar no Supabase, valide com cadastros de teste: receba duas matérias-primas, monte produtos que compartilhem uma delas, venda um kit, consulte o histórico e exclua a venda para conferir o estorno. Revise a contagem inicial antes de retomar os lançamentos reais.

## Atualização do modelo de compras

Se a migração já foi aplicada antes da mudança para compras exclusivamente de matéria-prima, gere e execute novamente `estoque-materias-primas.sql`. Isso atualiza as validações e retira a permissão de chamar as funções antigas de compra de produtos, sem recriar movimentos ou alterar saldos existentes.

## Custo médio por matéria-prima e CMV

Cada recebimento atualiza o custo médio móvel: **(saldo anterior × média anterior + quantidade recebida × preço unitário) ÷ novo saldo**. Saídas mantêm a média; o custo é aplicado às unidades consumidas. Quantidades devem usar a unidade cadastrada (kg, m, un etc.). As médias não são arredondadas internamente; o CMV total da venda é arredondado a centavos.

O produto usa **Σ(quantidade do componente por produto × custo médio da matéria-prima)**. O kit soma esse custo multiplicado pela quantidade de cada produto da sua composição. A checkbox de influência no saldo não exclui o item do custo: embalagem, pintura e demais itens de apoio também entram. Se faltar um item de apoio com custo conhecido, seu custo necessário é incluído e a venda é marcada como estimada.

Exemplo: 10 chapas a R$ 10 e outras 10 a R$ 30 resultam em média de R$ 20. Um produto com 2 chapas e 3 unidades de pintura a R$ 1 custa R$ 43. Um kit com 2 desses produtos custa R$ 86. Se ocorrer uma venda antes da próxima compra, a nova média considera apenas o saldo que restou.

Em Estoque → Matéria-prima, consulte custo médio e valor do saldo. Nos produtos/kits, abra **Ver cálculo do custo** para conferir as parcelas. As vendas mostram seu CMV gravado e os custos dos materiais usados. O cadastro do produto com composição exibe custo calculado, sem usar o custo manual cadastral nas novas vendas.

Entradas/ajustes que aumentam saldo aceitam custo unitário. Sem custo informado, a média atual é usada como estimativa; sem média conhecida, o custo permanece pendente. Para conciliar o valor de um saldo existente, use **Movimentar / ajustar → Ajustar custo médio**, informe custo e motivo. Isso preserva a quantidade e gera histórico. Não altera vendas anteriores. Toda conciliação manual é marcada como estimativa.

Na primeira aplicação do custeio, materiais existentes recebem uma referência estimada ponderada das compras recebidas disponíveis. Isso não reconstrói a ordem dos custos antigos nem altera CMVs históricos. Sem compras com preço conhecido, o custo fica ausente. Revise os saldos iniciais e ajuste os custos quando necessário. A inicialização não se repete ao reaplicar a migração.

O estorno de venda devolve material ao custo congelado na venda, ponderando-o com o saldo atual. Cancelar uma compra retira quantidade e valor da entrada original; é recusado se deixar saldo ou valor de estoque negativo. Registros anteriores sem custo conhecido permanecem explicitamente não apurados.

Gere e reaplique `estoque-materias-primas.sql` para ativar também o custeio. Os testes de PostgreSQL cobrem médias móveis, produto, kit, apoio, custo zero, ausência de custo, estorno, conciliação e proteção contra edição direta da média.

## Conciliação inicial de compras por produto

Para converter o histórico existente conforme compras menos vendas, use `scripts/gerar-conciliacao-materiais.mjs` sobre uma captura completa das tabelas, incluindo fornecedores, em `supabase/local/conciliacao/snapshot-atual.json`. Os dados locais e o SQL gerado ficam fora do Git. O gerador não acessa nem altera o banco. Capture com `node --env-file=.env.local scripts/capturar-conciliacao-materiais.mjs`. A captura guarda também o JSON bruto da API em `tabelas_exatas`, preservando os decimais PostgreSQL inclusive dentro do CMV. A conferência SQL usa esses valores exatos, evitando falsos alertas causados pelo arredondamento de números no JavaScript; alterações reais continuam bloqueando a importação.

O processo confere a correspondência única entre o nome de cada item antigo e a matéria-prima cadastrada, os totais e a compatibilidade da composição histórica com a atual. Importa os itens das compras e desconta os componentes congelados de cada venda, incluindo kits. Reposições com o mesmo ID da compra são conferidas e não entram novamente. Compras sem itens usam as quantidades da composição atual, identificadas como inferidas; seu custo permanece desconhecido, sem rateio inventado do valor do produto.

As entradas são registradas antes das saídas, conservando as datas dos documentos. Isso permite converter um histórico com lacunas cronológicas sem criar quantidades iniciais fictícias. O custo de abertura é uma referência ponderada estimada das entradas documentadas, não uma reconstrução do custo médio móvel histórico. As próximas compras seguem a média móvel. Materiais que receberam compras sem custo detalhado precisam de conciliação de custo com histórico.

O arquivo `supabase/local/conciliacao/aplicar-conciliacao.sql` inclui a atualização estrutural de custos e a conversão na mesma transação. Ele compara os registros com a captura sob locks e aborta se houver qualquer alteração na origem. Registra os movimentos e o consumo histórico para estorno, mantém os valores de CMV das vendas e zera o estoque físico dos produtos convertidos mediante ajuste auditado, evitando dupla contabilização. Cria pedidos de compra de matérias-primas recebidos, agrupados por compra original e fornecedor, com os itens documentados e movimentos vinculados. Não cria novas despesas nem rateios no balancete. As compras originais permanecem como histórico; os dois pedidos sem detalhamento permanecem sem novo documento de matérias-primas, para não inventar preços. Embalagem e pintura vinculadas à composição passam a não limitar o saldo, conforme a regra solicitada; continuam nos custos e alertas. O estado ativo/inativo não é alterado.

O lote é registrado em `conciliacoes_materiais_legacy`, com captura original, plano, instante e identidade SQL do executor, acessível apenas administrativamente. O campo `criado_por` dos movimentos importados preserva o autor do documento original, explicitamente informado no motivo; não representa o operador que executou a conversão. Reexecutar o mesmo lote não repete movimentos, mesmo após exclusões posteriores de vendas.

Validação local: `node scripts/testar-conciliacao-materiais.mjs` usa PostgreSQL descartável via Docker, sem acesso ao banco remoto. Cobre divergências na origem, rollback integral inclusive da estrutura, saldos, custos desconhecidos, preservação de CMV, pedidos recebidos com fornecedor e itens, reexecução, venda com embalagem indisponível, estornos de compra/venda e rejeição de correspondências ambíguas/saldos negativos.

Aplicação: pause lançamentos, execute o SQL no SQL Editor do Supabase ou configure `SUPABASE_DB_URL` no `.env.local` e rode `node --env-file=.env.local scripts/aplicar-conciliacao-materiais.mjs`. A conexão deve pertencer ao mesmo projeto de `NEXT_PUBLIC_SUPABASE_URL`. O executor usa `psql` local ou PostgreSQL 16 via Docker e nunca imprime a conexão. A chave `SUPABASE_SERVICE_ROLE_KEY` sozinha não permite executar essa atualização estrutural.

### Recuperação de custos históricos

`node scripts/recuperar-custos-historicos.mjs` gera `supabase/local/conciliacao/recuperar-custos-historicos.sql` para bancos já conciliados. Recupera somente médias ausentes com referência nos movimentos das compras históricas recebidas, ponderadas pelas quantidades com preço informado. Registra ajuste de custo estimado sem mudar quantidades, documentos ou vendas anteriores. Sem referência por componente, o custo fica não lançado. O script também atualiza o cálculo das novas vendas para somar os custos conhecidos. A conversão inicial já inclui essa recuperação.

Os cartões dos componentes em Estoque mostram entradas e saídas acumuladas (incluindo ajustes e estornos) e acesso ao histórico filtrado.
