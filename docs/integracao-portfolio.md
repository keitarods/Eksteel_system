# Integração de produtos com o portfólio

Em **Dashboard → Cadastro → Produtos**, a checkbox **Exibir no portfólio do site** controla a publicação. Novos produtos vêm marcados. Para ocultar um item, edite, desmarque e salve; para republicar, marque e salve. O produto também precisa estar ativo no sistema. Não depende de estoque disponível.

## Configuração inicial obrigatória

O sistema e o site devem usar o mesmo projeto Supabase, com a tabela `produtos_site` já existente.

1. Na raiz do Eksteel_system, execute `node scripts/gerar-integracao-portfolio.mjs`.
2. No SQL Editor do Supabase, execute o arquivo gerado `supabase/local/integracao-portfolio.sql` como administrador.
3. Publique a versão atualizada do sistema. O site já consulta somente os produtos públicos ativos; não requer nova variável nem alteração de código.

O script é estrutural, sem dados reais ou credenciais. O arquivo SQL gerado fica ignorado pelo Git; o gerador versionável permite reproduzi-lo. Não conceda escrita pública na tabela nem exponha a service role ao navegador.

A aplicação não consegue executar DDL através da chave REST do Supabase. Sem essa configuração inicial, a gravação informa que falta configurar a integração; não declara sincronização bem-sucedida.

## Comportamento

- Cada novo produto gera um registro público, mesmo desmarcado (nesse caso, inativo).
- Nome e categoria são copiados. Categoria vazia vira “Outros” no catálogo.
- Status público = ativo no sistema **e** checkbox marcada.
- O vínculo `produtos_site.produto_id` é único; edições não duplicam registros.
- O nome-base inicial das mídias é `produto_` seguido do UUID interno sem hífens. Consulte `arquivo_base` no registro público para nomear fotos e modelo 3D; imagens não são criadas automaticamente.
- Descrição, ordem, nome-base de arquivos e links comerciais existentes são preservados.
- Custos, preços internos, componentes, fornecedores e estoque não são copiados.
- O gatilho roda na mesma transação do produto: se a sincronização falhar, a gravação do produto também é revertida. Alterações de componentes têm fluxo separado preexistente.
- Excluir definitivamente um produto interno inativa o item público e remove seu vínculo, preservando mídia e descrição. Prefira inativar.
- A RLS interna continua autorizando quem pode cadastrar/editar. A função de gatilho tem search_path fixo e não pode ser chamada diretamente por anon/authenticated. As políticas públicas de leitura permanecem inalteradas.

## Catálogo legado

Não há publicação em massa de produtos internos existentes nem associação automática por nome. A checkbox começa desmarcada nesses cadastros. A indicação “Publicação no site” expressa a preferência de sincronização; registros manuais antigos continuam com seu status até serem vinculados.

Para vincular um item público já existente, um administrador deve preencher **uma vez** `produtos_site.produto_id` com o UUID do cadastro interno correspondente, preservando o ID público, as fotos e os links. Depois, editar o produto no sistema e salvar a checkbox aplica o status escolhido. Há restrição de unicidade para impedir vincular dois itens públicos ao mesmo produto. Um item manual com nome coincidente bloqueia uma nova publicação até a conciliação, em vez de sobrescrever dados ou criar uma cópia silenciosa.

Essa vinculação é necessária apenas para o legado; os novos cadastros são automáticos.

## Validação recomendada após aplicar

Cadastre um produto de teste, confira o registro público e a página de produtos do site. Edite nome/categoria, desmarque e marque a checkbox e verifique que o mesmo registro é atualizado. Confira que descrição, arquivo-base e links não mudam. Use somente registros de teste para validar exclusão.

## Testes automatizados

`node scripts/testar-integracao-portfolio.mjs` cria e remove um PostgreSQL 16 descartável no Docker, sem portas publicadas. Verifica idempotência, RLS, cadastro, edição, preservação de mídia, ocultação, reativação, rollback, exclusão e permissões. Não acessa o Supabase real.

## Editar conteúdo e fotos pelo sistema

Após cadastrar o produto, acesse **Cadastro → Produtos → Editar site**. O botão está disponível a administradores e sócios aprovados. O produto deve estar vinculado ao catálogo conforme a configuração inicial acima.

- Edite descrição, os dois links do Mercado Livre e a ordem (menor primeiro). Clique em **Salvar dados do site**.
- Envie imagens JPEG, PNG ou WebP de até 3 MB cada. O envio é imediato; nomes são gerados automaticamente para o bucket `produtos-imagens`. A primeira foto é a capa, novas fotos são acrescentadas ao final.
- A remoção exige confirmação e é imediata. Nome-base compartilhado por vários produtos bloqueia alterações nas imagens até correção do cadastro.
- Nome, categoria e visibilidade continuam no formulário principal. IDs, vínculo e nome-base são protegidos; arquivos/modelos 3D já existentes não são modificados por este editor.
- O site recebeu um ajuste para preservar a capa antiga sem sufixo ao adicionar fotos numeradas. Publique também esse ajuste no Eksteel-site.

Não há nova migração SQL nesta etapa. A integração anterior e os buckets precisam existir. `SUPABASE_SERVICE_ROLE_KEY` deve estar configurada somente no servidor do sistema (Vercel); nunca use prefixo NEXT_PUBLIC nessa chave. A rota valida sessão, papel aprovado, acesso ao produto pela RLS e origem antes de usar o cliente de serviço. Não é necessário conceder upload público no Storage.

Validação: `node --experimental-strip-types scripts/portfolio-editor.test.mjs` testa lista permitida de campos, links, assinatura de imagem, autorização, upload sem sobrescrita e isolamento da remoção. Os testes usam clientes fictícios e não alteram produção.

## Produtos e matérias-primas

Somente registros da tabela `produtos` participam da sincronização com `produtos_site`. Cadastrar, editar, inativar ou excluir registros em `materias_primas` não publica nem altera itens do catálogo. Componentes de um produto também não são publicados individualmente. A opção de publicação e o editor do site pertencem apenas ao cadastro de produtos. Não é necessária migração adicional para essa separação.
