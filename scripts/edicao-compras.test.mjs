import { migrationSql } from './gerar-edicao-compras.mjs';

export function testarEdicaoCompras(sql, id, assertSql, rejects) {
  sql(migrationSql); sql(migrationSql);
  const itens = (q, v) => `'[{"materia_prima_id":"${id(701)}","descricao":"Material de edição","quantidade":${q},"valor_unitario":${v}}]'`;
  const editar = (q, v, status = 'recebido', versao = `(select atualizado_em from public.pedidos_compra where id='${id(702)}')`) => `public.editar_compra_materiais('${id(702)}','${id(99)}',current_date,'${status}',${q * v},'Corrigida',${itens(q,v)},${versao})`;
  sql(`
    insert into public.materias_primas(id,nome,unidade) values('${id(701)}','Material de edição','un');
    insert into public.produtos(id,nome,custo,estoque_atual) values('${id(705)}','Produto teste edição',20,0);
    insert into public.componentes_produto(produto_id,materia_prima_id,nome_peca,quantidade) values('${id(705)}','${id(701)}','Material teste',1);
    set role authenticated;
    select public.salvar_compra_materiais('${id(702)}','${id(99)}',current_date,'recebido',100,'Original',${itens(10,10)});
    select ${editar(12, 15)};
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=12`, 'Edição duplicou estoque')}
    ${assertSql(`(select custo_medio from public.materias_primas where id='${id(701)}')=15`, 'Custo incorreto após edição')}
    ${assertSql(`(select count(*) from public.pedidos_compra where id='${id(702)}')=1`, 'Edição duplicou documento')}
    set role authenticated;
    ${rejects(`perform ${editar(13,15,'recebido',"null")}`, 'Aceitou edição obsoleta')}
    select ${editar(12,15)};
    reset role;
    ${assertSql(`(select count(*) from public.movimentos_estoque where referencia_id='${id(702)}')=3`, 'Reenvio duplicou movimentos')}
    set role authenticated;
    ${rejects(`update public.pedido_compra_itens set quantidade=99 where pedido_compra_id='${id(702)}'`, 'Permitiu edição direta')}
    ${rejects(`insert into public.compra_edicao_contexto values(txid_current(),'${id(702)}')`, 'Contexto privado acessível')}
    update public.pedidos_compra set status='cancelado' where id='${id(702)}';
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=0`, 'Cancelamento estornou versões antigas')}
    set role authenticated;
    select ${editar(5, 20)};
    insert into public.vendas(id,produto_id,quantidade,data) values('${id(703)}','${id(705)}',4,current_date);
    select ${editar(5,20)};
    select ${editar(7,20)};
    select ${editar(6,20)};
    select ${editar(6,30)};
    ${rejects(`perform ${editar(3,30)}`, 'Redução gerou saldo negativo')}
    ${rejects(`perform public.excluir_compra_materiais('${id(702)}',(select atualizado_em from public.pedidos_compra where id='${id(702)}'))`, 'Exclusão gerou saldo negativo')}
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=2`, 'Edição não aplicou somente a diferença')}
    ${assertSql(`(select valor_total from public.pedidos_compra where id='${id(702)}')=180`, 'Falha alterou documento')}
    ${assertSql(`(select custo_medio from public.materias_primas where id='${id(701)}')=30`, 'Preço consumido não corrigiu saldo remanescente')}
    ${assertSql(`(select cmv_total from public.vendas where id='${id(703)}')=80`, 'Correção alterou CMV histórico')}
    ${assertSql(`not exists(select 1 from public.compra_edicao_contexto)`, 'Contexto vazou')}
    set role authenticated;
    select public.editar_compra_materiais('${id(40)}','${id(99)}',current_date-1,'recebido',10,'Histórico corrigido',${itens(1,10)},null);
    reset role;
    ${assertSql(`not exists(select 1 from public.movimentos_estoque where referencia_id='${id(40)}')`, 'Histórico relançou estoque')}
    ${assertSql(`(select estoque_integrado from public.pedidos_compra where id='${id(40)}')`, 'Histórico perdeu proteção')}
    set role authenticated;
    ${rejects(`perform public.excluir_compra_materiais('${id(702)}',null)`, 'Exclusão aceitou versão obsoleta')}
    select public.movimentar_estoque('${id(704)}','${id(701)}',null,'entrada',4,current_date,'Reposição para exclusão',null,30);
    select public.excluir_compra_materiais('${id(702)}',(select atualizado_em from public.pedidos_compra where id='${id(702)}'));
    select public.excluir_compra_materiais('${id(702)}',null);
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=0`, 'Exclusão não estornou o saldo da compra')}
    ${assertSql(`not exists(select 1 from public.pedidos_compra where id='${id(702)}')`, 'Compra não excluída')}
    ${assertSql(`not exists(select 1 from public.pedido_compra_itens where pedido_compra_id='${id(702)}')`, 'Itens órfãos')}
    ${assertSql(`exists(select 1 from public.compras_auditoria where pedido_id='${id(702)}' and operacao='exclusao' and antes->'pedido'->>'valor_total'='180')`, 'Exclusão sem histórico')}
    set role authenticated;
    select public.excluir_compra_materiais('${id(40)}',(select atualizado_em from public.pedidos_compra where id='${id(40)}'));
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=0`, 'Exclusão histórica mudou estoque')}
    set role authenticated;
    select public.salvar_compra_materiais('${id(706)}','${id(99)}',current_date,'pendente',10,'Pendente teste',${itens(1,10)});
    select public.excluir_compra_materiais('${id(706)}',null);
    select public.salvar_compra_materiais('${id(707)}','${id(99)}',current_date,'recebido',40,'Consumo integral',${itens(2,20)});
    insert into public.vendas(id,produto_id,quantidade,data) values('${id(708)}','${id(705)}',2,current_date);
    select public.editar_compra_materiais('${id(707)}','${id(99)}',current_date,'recebido',60,'Preço corrigido',${itens(2,30)},null);
    reset role;
    ${assertSql(`public.saldo_material('${id(701)}')=0`, 'Correção de compra totalmente consumida movimentou quantidade')}
    ${assertSql(`(select cmv_total from public.vendas where id='${id(708)}')=40`, 'Preço corrigido alterou CMV de consumo integral')}
    ${assertSql(`not exists(select 1 from public.pedidos_compra where id='${id(706)}')`, 'Exclusão de pendente falhou')}
    update public.usuarios_empresa set papel='pendente' where usuario_id=auth.uid();
    set role authenticated;
    ${rejects(`perform ${editar(5,20)}`, 'Usuário pendente editou compra')}
    ${rejects(`perform public.excluir_compra_materiais('${id(702)}',null)`, 'Usuário pendente excluiu compra')}
    reset role;
    update public.usuarios_empresa set papel='socio' where usuario_id=auth.uid();
  `);
  console.log('OK: edição parcialmente consumida por diferença, correção de preço, exclusão auditada, custo, reenvio, versão obsoleta, cancelamento após edição, rollback, histórico e permissões.');
}
