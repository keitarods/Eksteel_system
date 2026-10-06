import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const migrationSql = `
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('notas-fiscais','notas-fiscais',false,20971520,array['application/pdf','application/xml','text/xml','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Caminho: vendas|compras / UUID do lançamento / UUID / nome do arquivo.
-- SECURITY INVOKER preserva também as políticas de leitura do lançamento.
create or replace function public.acessar_nota_fiscal(p_nome text)
returns boolean language sql stable set search_path='' as $$
 select public.estoque_autorizado()
 and array_length(string_to_array(p_nome,'/'),1)=4
 and case split_part(p_nome,'/',1)
 when 'vendas' then exists(select 1 from public.vendas where id::text=split_part(p_nome,'/',2))
 when 'compras' then exists(select 1 from public.pedidos_compra where id::text=split_part(p_nome,'/',2))
 else false end;
$$;
revoke all on function public.acessar_nota_fiscal(text) from public,anon;
grant execute on function public.acessar_nota_fiscal(text) to authenticated;
drop policy if exists notas_fiscais_leitura on storage.objects;
create policy notas_fiscais_leitura on storage.objects for select to authenticated
using(bucket_id='notas-fiscais' and public.acessar_nota_fiscal(name));
drop policy if exists notas_fiscais_envio on storage.objects;
create policy notas_fiscais_envio on storage.objects for insert to authenticated
with check(bucket_id='notas-fiscais' and public.acessar_nota_fiscal(name));
-- Sem sobrescrita: cada envio tem seu próprio UUID.
drop policy if exists notas_fiscais_exclusao on storage.objects;
create policy notas_fiscais_exclusao on storage.objects for delete to authenticated
using(bucket_id='notas-fiscais' and public.acessar_nota_fiscal(name));
commit;
`;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 mkdirSync('supabase/local',{recursive:true});
 writeFileSync('supabase/local/notas-fiscais.sql',migrationSql);
 console.log('Gerado supabase/local/notas-fiscais.sql');
}
