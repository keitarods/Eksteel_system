import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Migração estrutural; não contém credenciais nem dados de produtos.
export const migrationSql = `begin;

-- Execute uma vez, como administrador, no SQL Editor do MESMO Supabase do sistema/site.
-- A tabela pública e suas políticas de leitura já devem existir.
alter table public.produtos add column if not exists publicar_site boolean not null default false;
-- Cadastros antigos permanecem fora da sincronização até adesão explícita.
alter table public.produtos alter column publicar_site set default true;
alter table public.produtos_site add column if not exists produto_id uuid
  references public.produtos(id) on delete set null;
create unique index if not exists produtos_site_produto_id_unique on public.produtos_site(produto_id);

create or replace function public.sincronizar_produto_portfolio()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    update public.produtos_site set ativo = false where produto_id = OLD.id;
    return OLD;
  end if;

  -- Não publica retroativamente os cadastros antigos por uma edição de custo/nome.
  if TG_OP = 'UPDATE' and not NEW.publicar_site and not exists (
    select 1 from public.produtos_site where produto_id = NEW.id
  ) then
    return NEW;
  end if;

  -- Nunca vincula automaticamente produtos legados apenas pelo nome.
  -- Impede criar uma cópia acidental de um item já cadastrado manualmente.
  if not exists (select 1 from public.produtos_site where produto_id = NEW.id)
     and exists (select 1 from public.produtos_site where produto_id is null
       and lower(btrim(nome)) = lower(btrim(NEW.nome))) then
    raise exception 'Este nome já existe no catálogo do site sem vínculo. Vincule o cadastro existente antes de publicar, para preservar fotos e evitar duplicidade.';
  end if;

  insert into public.produtos_site (produto_id, nome, categoria, arquivo_base, ativo)
  values (NEW.id, NEW.nome, coalesce(nullif(btrim(NEW.categoria), ''), 'Outros'),
    'produto_' || replace(NEW.id::text, '-', ''), NEW.ativo and NEW.publicar_site)
  on conflict (produto_id) do update set
    nome = excluded.nome,
    categoria = excluded.categoria,
    ativo = excluded.ativo;
  -- descricao, arquivo_base, links, ordem e mídia são preservados em atualizações.
  return NEW;
end;
$$;
revoke all on function public.sincronizar_produto_portfolio() from public, anon, authenticated;

drop trigger if exists sincronizar_produto_portfolio_gravacao on public.produtos;
create trigger sincronizar_produto_portfolio_gravacao
  after insert or update of nome, categoria, ativo, publicar_site on public.produtos
  for each row execute function public.sincronizar_produto_portfolio();
drop trigger if exists sincronizar_produto_portfolio_exclusao on public.produtos;
create trigger sincronizar_produto_portfolio_exclusao
  before delete on public.produtos
  for each row execute function public.sincronizar_produto_portfolio();

comment on column public.produtos.publicar_site is 'Exibir no portfólio quando também estiver ativo no sistema.';
comment on column public.produtos_site.produto_id is 'Vínculo único com produto interno. Custos, preços internos e estoque não são publicados.';
notify pgrst, 'reload schema';
commit;
`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arquivo = resolve('supabase/local/integracao-portfolio.sql');
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, migrationSql);
  console.log(`Script gerado em ${arquivo}. Execute no SQL Editor do Supabase antes de usar a integração.`);
}
