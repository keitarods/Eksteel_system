import { migrationSql } from './gerar-devolucoes.mjs';
export function testarDevolucoes(sql, id, check, rejects) {
 sql(migrationSql); sql(migrationSql);
 const itens=JSON.stringify([{produto_id:id(3),quantidade:2,valor_unitario:12.50,em_boas_condicoes:true},{produto_id:id(1),quantidade:1,valor_unitario:20,em_boas_condicoes:true},{produto_id:id(3),quantidade:3,valor_unitario:5,em_boas_condicoes:false}]);
 sql(`begin;
 create temporary table antes as select estoque_atual from public.produtos where id='${id(3)}';
 create temporary table antes_mp as select public.saldo_material('${id(11)}') saldo;
 grant select on antes,antes_mp to authenticated;
 set local role authenticated;
 select public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}');
 select public.registrar_devolucao('${id(810)}',current_date,'PED-123','Teste','${itens}');
 ${check(`(select valor_total=60 and quantidade=6 from public.devolucoes where id='${id(810)}')`,'Total incorreto')}
 ${check(`(select estoque_atual from public.produtos where id='${id(3)}')=(select estoque_atual+2 from antes)`,'Duplicou reposição ou repôs avariado')}
 reset role;
 ${check(`public.saldo_material('${id(11)}')=(select saldo+2 from antes_mp)`,'Não repôs componentes')}
 set local role authenticated;
 ${rejects(`perform public.registrar_devolucao('${id(810)}',current_date,'OUTRO','','${itens}')`,'Aceitou chave duplicada com outro pedido')}
 ${rejects(`perform public.registrar_devolucao('${id(811)}',current_date,'','','[{"produto_id":"${id(3)}","quantidade":1,"valor_unitario":10,"em_boas_condicoes":true},{"produto_id":"${id(999)}","quantidade":1,"valor_unitario":10,"em_boas_condicoes":true}]')`,'Aceitou produto inexistente')}
 ${check(`(select estoque_atual from public.produtos where id='${id(3)}')=(select estoque_atual+2 from antes)`,'Falha parcial deixou estoque alterado')}
 ${rejects(`perform public.registrar_devolucao('${id(812)}',current_date,'','','[{"produto_id":"${id(3)}","quantidade":-1,"valor_unitario":10,"em_boas_condicoes":true}]')`,'Aceitou quantidade negativa')}
 ${rejects(`delete from public.devolucoes`,'Permitiu apagar histórico')}
 reset role; update public.usuarios_empresa set papel='pendente'; set local role authenticated;
 ${check(`(select count(*) from public.devolucoes)=0`,'RLS expôs devoluções')}
 ${rejects(`perform public.registrar_devolucao('${id(813)}',current_date,'','','${itens}')`,'Pendente lançou devolução')}
 rollback;`);
 console.log('OK: devoluções, reposição física e composta, avariados, idempotência, rollback e permissões.');
}
