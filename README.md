# Eksteel_system
Sistema de gestão financeira e operacional para microempresa de projetos mecânicos — controle de vendas em marketplaces (Mercado Livre, Shopee), estoque, compras, fornecedores e fluxo de caixa.

## Publicação e acesso em outros dispositivos

Configure as variáveis de `.env.local.example` no ambiente de hospedagem. Defina `NEXT_PUBLIC_SITE_URL` com o endereço público definitivo, por exemplo `https://sistema.seu-dominio.com.br`, antes de executar `npm run build`. Execute o build com `npm start` no servidor, ou publique em uma hospedagem compatível com Next.js.

O domínio deve apontar para a hospedagem e ter certificado HTTPS válido. No Supabase, configure **Authentication → URL Configuration → Site URL** com esse domínio e inclua `https://SEU-DOMINIO/auth/callback` entre as URLs de redirecionamento permitidas. Teste login e recuperação de senha no celular usando dados móveis. `localhost` só funciona no próprio dispositivo; metadados de SEO não tornam um servidor local acessível pela internet.

A página de login possui título, descrição, URL canônica e metadados para compartilhamento. O sitemap inclui somente essa página pública quando `NEXT_PUBLIC_SITE_URL` está configurada. As telas internas e os orçamentos não são indexáveis por padrão; a autenticação continua responsável por controlar o acesso. As convenções de metadados seguem a [documentação do Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).

Para liberar a edição de compras, aplique também a migração descrita em [Estoque de matérias-primas](docs/estoque-materias-primas.md#editar-compras-já-lançadas).

## Desenhos do Model System

A tela inicial inclui **Engenharia → Desenhos**, em `/desenhos`. A biblioteca agrupa os PDFs publicados pelo Model System por autor e pasta, com busca por nome, origem e observação, visualização no navegador e download. Pastas aparecem quando contêm PDFs acessíveis; pastas vazias e arquivos nativos não são listados. Cada envio aparece como uma cópia independente com data e tamanho.

A integração usa o catálogo `eksteel_cad_documents` e o bucket privado `cad-documents` existentes no Supabase configurado no sistema. No Model System, conecte **Projetos na nuvem** ao mesmo Supabase de armazenamento, escolha/crie uma pasta e use **Gerar e enviar PDF** ou **Enviar arquivo**. Depois atualize a biblioteca no Gestão. Criar pastas e publicar documentos permanece no Model System.

O acesso usa a sessão do usuário e as políticas RLS do Model System, sem chave de serviço no navegador. Administradores e sócios podem abrir a tela, mas isso não concede acesso automático aos arquivos de outros autores: as pastas compartilhadas dependem de autorização em `eksteel_cad_document_readers` para o usuário autenticado no mesmo Supabase. A nova tela não altera essas permissões. Caso o catálogo não exista em outro ambiente, aplique as migrações da biblioteca de documentos do Model System nesse Supabase antes de usar a integração.

Validação da biblioteca: `node --experimental-strip-types scripts/desenhos-biblioteca.test.mjs`.

## Devoluções de ecommerce

Gere a migração com `node scripts/gerar-devolucoes.mjs` e execute `supabase/local/devolucoes.sql` no SQL Editor do Supabase, após as migrações de CMV e estoque de matérias-primas. A migração é reaplicável. A aplicação exige essa tabela para carregar os indicadores completos.

Na aba **Devoluções**, informe data, código de cada produto, quantidade inteira, valor unitário efetivamente devolvido e, opcionalmente, número do pedido e observação. **Em boas condições** vem marcado; desmarque para itens avariados. Separe condições diferentes em linhas distintas. O pedido é uma referência textual, sem vínculo automático ou limite baseado em uma venda cadastrada.

O lançamento e a reposição são atômicos e protegidos contra repetição da mesma tentativa. Produtos simples retornam ao saldo físico; produtos compostos retornam às quantidades equivalentes de matérias-primas da composição atual, conforme o modelo de estoque existente. O histórico preserva os códigos, nomes e condições informados. Lançamentos são imutáveis nesta versão.

Dashboard e DRE deduzem o valor no período da devolução, preservando vendas brutas, CMV e taxas originais. Rankings de produtos e canais continuam mostrando vendas antes de devoluções. A aba Devoluções inclui unidades, valor, número de lançamentos e sazonalidade dos últimos 12 meses.

Validação: `npm run test:relatorios`, `npx tsc --noEmit` e `npm run test:estoque:db` (PostgreSQL temporário via Docker, incluindo devoluções, rollback, idempotência e permissões).

## Notas fiscais no Storage

Gere `supabase/local/notas-fiscais.sql` com `node scripts/gerar-notas-fiscais.mjs` e execute-o no SQL Editor do Supabase após a migração de estoque. Cria/configura o bucket privado `notas-fiscais` e suas políticas para administradores e sócios, respeitando também o acesso ao lançamento. Não requer chave de serviço no navegador.

Após salvar uma venda ou pedido de compra, abra seus detalhes e use **Notas fiscais de venda/compra** para anexar, baixar ou remover documentos. Aceita PDF, XML, JPG e PNG até 20 MB cada. Cada envio tem uma pasta UUID própria, sem sobrescrever arquivos anteriores. Downloads usam a sessão autenticada. O nome é normalizado para compatibilidade com o Storage.

A nota fica vinculada ao lançamento completo (inclusive todos os itens do pedido). Excluir um lançamento não apaga seus arquivos automaticamente, mas bloqueia o acesso pela aplicação; limpeza administrativa de arquivos órfãos deve ser feita no Storage. A configuração de formatos e tamanho é verificada também pelo serviço Storage, sem validação fiscal do conteúdo.

Testes: `node --experimental-strip-types --test scripts/notas-fiscais.test.mjs` e `npm run test:estoque:db` (inclui políticas de acesso às notas em PostgreSQL isolado).
