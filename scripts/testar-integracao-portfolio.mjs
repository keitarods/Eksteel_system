import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { migrationSql } from './gerar-integracao-portfolio.mjs';

// PostgreSQL descartável, sem portas publicadas, volumes ou dados de produção.
const container = `eksteel-portfolio-test-${randomUUID()}`;
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000 });
const sql = (input) => docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input);
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=local-test-only', 'postgres:16-alpine']);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error('PostgreSQL de teste não iniciou.');
  sql(`create role anon; create role authenticated;
    create table public.materias_primas (id uuid primary key, nome text, custo numeric, ativo boolean default true);
    grant select,insert,update,delete on public.materias_primas to authenticated;
    create table public.produtos (id uuid primary key default gen_random_uuid(), nome text not null, categoria text, ativo boolean not null default true, custo numeric);
    create table public.produtos_site (id uuid primary key default gen_random_uuid(), nome text not null, categoria text not null, descricao text, arquivo_base text not null, link_mercado_livre text, link_mercado_livre_2 text, ordem int not null default 0, ativo boolean not null default true, created_at timestamptz default now());
    insert into public.produtos (id,nome,categoria) values ('00000000-0000-0000-0000-000000000001','Interno antigo','Teste');
    insert into public.produtos_site (nome,categoria,arquivo_base) values ('Manual legado','Teste','manual');
    alter table public.produtos enable row level security;
    alter table public.produtos_site enable row level security;
    grant select,insert,update,delete on public.produtos to authenticated;
    create policy operador on public.produtos for all to authenticated using (true) with check (true);
    grant select on public.produtos_site to anon,authenticated;
    create policy leitura_publica on public.produtos_site for select to anon,authenticated using(ativo=true);
  `);
  sql(migrationSql); sql(migrationSql); // Reexecução segura.
  sql(`do $$ begin
    if (select publicar_site from public.produtos where nome='Interno antigo') then raise exception 'Legado foi publicado'; end if;
    if (select count(*) from public.produtos_site) <> 1 then raise exception 'Backfill inesperado'; end if;
  end $$;
  set role authenticated;
  insert into public.produtos (id,nome,categoria,custo) values ('00000000-0000-0000-0000-000000000002','Produto novo','Teste',12345);
  reset role;
  do $$ begin
    if (select count(*) from public.produtos_site where produto_id='00000000-0000-0000-0000-000000000002' and ativo) <> 1 then raise exception 'Cadastro não sincronizado'; end if;
  end $$;
  set role authenticated;
  insert into public.materias_primas(id,nome,custo) values
    ('00000000-0000-0000-0000-000000000002','Produto novo',99),
    ('00000000-0000-0000-0000-000000000099','Chapa de aço',50);
  update public.materias_primas set nome='Matéria-prima alterada',ativo=false;
  delete from public.materias_primas;
  reset role;
  do $$ begin
    if (select count(*) from public.produtos_site) <> 2 then raise exception 'Matéria-prima alterou o catálogo público'; end if;
    if not exists(select 1 from public.produtos_site where produto_id='00000000-0000-0000-0000-000000000002' and nome='Produto novo' and ativo) then raise exception 'Matéria-prima alterou produto publicado'; end if;
  end $$;
  update public.produtos_site set descricao='Preservar',arquivo_base='foto-existente',link_mercado_livre='https://example.test/anuncio',ordem=8 where produto_id='00000000-0000-0000-0000-000000000002';
  set role authenticated;
  update public.produtos set nome='Nome atualizado',categoria='' where id='00000000-0000-0000-0000-000000000002';
  update public.produtos set publicar_site=false where id='00000000-0000-0000-0000-000000000002';
  reset role;
  do $$ begin
    if not exists(select 1 from public.produtos_site where produto_id='00000000-0000-0000-0000-000000000002' and not ativo and nome='Nome atualizado' and categoria='Outros' and descricao='Preservar' and arquivo_base='foto-existente' and ordem=8 and link_mercado_livre='https://example.test/anuncio') then raise exception 'Edição não preservou dados ou status'; end if;
  end $$;
  set role anon;
  do $$ begin
    if exists(select 1 from public.produtos_site where nome='Nome atualizado') then raise exception 'Inativo visível ao público'; end if;
  end $$;
  reset role;
  update public.produtos set publicar_site=true,ativo=false where id='00000000-0000-0000-0000-000000000002';
  do $$ begin
    if exists(select 1 from public.produtos_site where produto_id='00000000-0000-0000-0000-000000000002' and ativo) then raise exception 'Produto interno inativo publicado'; end if;
  end $$;
  update public.produtos set ativo=true where id='00000000-0000-0000-0000-000000000002';
  do $$ begin
    if not exists(select 1 from public.produtos_site where produto_id='00000000-0000-0000-0000-000000000002' and ativo) then raise exception 'Reativação falhou'; end if;
  end $$;
  insert into public.produtos (nome,publicar_site) values ('Novo oculto',false);
  do $$ begin
    if not exists(select 1 from public.produtos_site where nome='Novo oculto' and not ativo) then raise exception 'Novo oculto não criado'; end if;
    begin
      insert into public.produtos (nome) values ('Manual legado');
      raise exception 'Duplicidade foi aceita' using errcode='XX000';
    exception when raise_exception then null;
    end;
    if exists(select 1 from public.produtos where nome='Manual legado') then raise exception 'Falha não reverteu cadastro'; end if;
  end $$;
  delete from public.produtos where id='00000000-0000-0000-0000-000000000002';
  do $$ begin
    if not exists(select 1 from public.produtos_site where nome='Nome atualizado' and not ativo and produto_id is null and descricao='Preservar') then raise exception 'Exclusão não preservou item oculto'; end if;
    if has_function_privilege('anon','public.sincronizar_produto_portfolio()','execute') or has_function_privilege('authenticated','public.sincronizar_produto_portfolio()','execute') then raise exception 'Função exposta'; end if;
    if has_table_privilege('anon','public.produtos_site','insert') then raise exception 'Escrita pública habilitada'; end if;
  end $$;`);
  console.log('OK: matérias-primas isoladas do catálogo, migração idempotente, cadastro autenticado, atualização, ocultação pública, reativação, preservação de mídia, legado, rollback, exclusão e permissões.');
} finally {
  try { docker(['rm', '-f', container]); } catch { /* Pode falhar se o container não chegou a ser criado. */ }
}
