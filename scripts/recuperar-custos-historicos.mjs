import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apurarCmvSql } from './custeio-materiais-sql.mjs';

// Recupera somente médias ausentes, sem alterar preços dos documentos ou CMVs antigos.
export const recuperarCustosSql = `
do $recuperar_custos$
declare r record; media numeric; saldo numeric; movimento uuid;
begin
 for r in select id,criado_por from public.materias_primas where custo_medio is null order by id loop
  perform 1 from public.materias_primas where id=r.id and custo_medio is null for update;
  if not found then continue; end if;
  movimento:=md5('recuperacao-custos-historicos-v1:' || r.id::text)::uuid;
  if exists(select 1 from public.movimentos_estoque where id=movimento) then continue; end if;
  select sum(m.quantidade*m.custo_informado)/sum(m.quantidade) into media
  from public.movimentos_estoque m join public.pedidos_compra p on p.id=m.referencia_id
  where m.materia_prima_id=r.id and m.tipo='compra' and m.quantidade>0
    and m.custo_informado>=0 and p.status='recebido'
    and p.estoque_payload->>'origem'='conversao-inicial-materias-primas-v1';
  if media is null then continue; end if;
  saldo:=public.saldo_material(r.id);
  insert into public.movimentos_estoque(id,materia_prima_id,quantidade,saldo_apos,tipo,data,motivo,custo_informado,custo_origem_estimado,criado_por)
  values(movimento,r.id,0,saldo,'ajuste_custo',(now() at time zone 'America/Sao_Paulo')::date,
    'Referência estimada: média ponderada das compras históricas recebidas com custo informado. Compras sem detalhamento não compõem a média. Recuperação administrativa executada por ' || current_user || '; autor do cadastro preservado.',media,true,r.criado_por);
 end loop;
end;
$recuperar_custos$;
`;

export const corrigirCustosSql = `-- Executar após a conciliação inicial. Preserva quantidades e vendas anteriores.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
${recuperarCustosSql}
${apurarCmvSql}
notify pgrst,'reload schema';
commit;
select codigo,nome,custo_medio,custo_medio_estimado from public.materias_primas order by codigo;
`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const arquivo=resolve('supabase/local/conciliacao/recuperar-custos-historicos.sql');
 mkdirSync(dirname(arquivo),{recursive:true});
 writeFileSync(arquivo,corrigirCustosSql,{mode:0o600});
 console.log(arquivo);
}
