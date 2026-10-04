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
