import { migrationSql } from './gerar-devolucoes.mjs';
export function testarDevolucoes(sql, id, check, rejects) {
 sql(migrationSql); sql(migrationSql);
 const itens=JSON.stringify([{produto_id:id(3),quantidade:2,valor_unitario:12.50,em_boas_condicoes:true},{produto_id:id(1),quantidade:1,valor_unitario:20,em_boas_condicoes:true},{produto_id:id(3),quantidade:3,valor_unitario:5,em_boas_condicoes:false}]);
 sql(`begin;
 insert into public.vendas(id,produto_id,quantidade) values('${id(820)}','${id(3)}',1),('${id(821)}','${id(3)}',1);
 create temporary table antes as select estoque_atual from public.produtos where id='${id(3)}';
 create temporary table antes_mp as select public.saldo_material('${id(11)}') saldo;
 grant select on antes,antes_mp to authenticated;
 set local role authenticated;
 select public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}',null,array['${id(820)}','${id(821)}']::uuid[],7.50);
 select public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}',null,array['${id(821)}','${id(820)}','${id(820)}']::uuid[],7.50);
 ${check(`(select count(*)=2 from public.devolucoes_vendas where devolucao_id='${id(810)}' and venda_id in ('${id(820)}','${id(821)}'))`,'Não vinculou ambos os pedidos')}
 ${rejects(`perform public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}','${id(821)}')`,'Aceitou reenvio com outro vínculo')}
 ${rejects(`perform public.registrar_devolucao('${id(814)}',current_date,'','','${itens}','${id(999)}')`,'Aceitou pedido inexistente')}
 ${rejects(`perform public.registrar_devolucao('${id(815)}',current_date,'','','${itens}',null,array['${id(820)}','${id(999)}']::uuid[])`,'Aceitou lista com pedido inexistente')}
 ${check(`not exists(select 1 from public.devolucoes where id='${id(815)}')`,'Pedido inválido deixou devolução parcial')}
 ${check(`(select custo_extra=7.50 from public.devolucoes where id='${id(810)}')`,'Custo extra não salvo')}
 ${rejects(`perform public.registrar_devolucao('${id(816)}',current_date,'','','${itens}',null,'{}',-1)`,'Aceitou custo negativo')}
 ${rejects(`perform public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}',null,array['${id(820)}','${id(821)}']::uuid[],8)`,'Aceitou reenvio com custo diferente')}
 ${check(`(select valor_total=60 and quantidade=6 from public.devolucoes where id='${id(810)}')`,'Total incorreto')}
 ${check(`(select estoque_atual from public.produtos where id='${id(3)}')=(select estoque_atual+2 from antes)`,'Duplicou reposição ou repôs avariado')}
 reset role;
 ${check(`public.saldo_material('${id(11)}')=(select saldo+2 from antes_mp)`,'Não repôs componentes')}
 set local role authenticated;
 ${rejects(`perform public.registrar_devolucao('${id(810)}',current_date,'OUTRO','','${itens}')`,'Aceitou chave duplicada com outro pedido')}
 ${rejects(`perform public.registrar_devolucao('${id(811)}',current_date,'','','[{"produto_id":"${id(3)}","quantidade":1,"valor_unitario":10,"em_boas_condicoes":true},{"produto_id":"${id(999)}","quantidade":1,"valor_unitario":10,"em_boas_condicoes":true}]')`,'Aceitou produto inexistente')}
 ${check(`(select estoque_atual from public.produtos where id='${id(3)}')=(select estoque_atual+2 from antes)`,'Falha parcial deixou estoque alterado')}
 ${rejects(`perform public.registrar_devolucao('${id(812)}',current_date,'','','[{"produto_id":"${id(3)}","quantidade":-1,"valor_unitario":10,"em_boas_condicoes":true}]')`,'Aceitou quantidade negativa')}
 ${rejects(`delete from public.devolucoes_vendas`,'Permitiu apagar vínculos')}
 ${rejects(`delete from public.devolucoes`,'Permitiu apagar histórico')}
 reset role;
 do $$begin
 begin delete from public.vendas where id='${id(820)}'; raise exception 'Apagou pedido vinculado';
 exception when foreign_key_violation then null; end;
 end$$;
 -- Simula vínculo da versão anterior e reaplica a migração sem sair da transação do teste.
 insert into public.devolucoes(id,data,pedido,itens,valor_total,quantidade,venda_id)
 values('${id(819)}',current_date,'Antigo','{}',1,1,'${id(820)}');
 ${migrationSql.replace('begin;', '').replace('commit;', '')}
 ${migrationSql.replace('begin;', '').replace('commit;', '')}
 ${check(`(select count(*)=1 from public.devolucoes_vendas where devolucao_id='${id(819)}' and venda_id='${id(820)}')`,'Migração perdeu ou duplicou vínculo antigo')}
 ${check(`(select count(*)=2 from public.devolucoes_vendas where devolucao_id='${id(810)}')`,'Migração alterou vínculos múltiplos')}
 update public.usuarios_empresa set papel='pendente'; set local role authenticated;
 ${check(`(select count(*) from public.devolucoes)=0`,'RLS expôs devoluções')}
 ${check(`(select count(*) from public.devolucoes_vendas)=0`,'RLS expôs vínculos')}
 ${rejects(`perform public.registrar_devolucao('${id(813)}',current_date,'','','${itens}')`,'Pendente lançou devolução')}
 rollback;`);
 console.log('OK: devoluções com múltiplos pedidos, migração de vínculos antigos, reposição física e composta, avariados, idempotência, rollback e permissões.');
}
