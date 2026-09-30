# Eksteel_system
Sistema de gestão financeira e operacional para microempresa de projetos mecânicos — controle de vendas em marketplaces (Mercado Livre, Shopee), estoque, compras, fornecedores e fluxo de caixa.

## Publicação e acesso em outros dispositivos

Configure as variáveis de `.env.local.example` no ambiente de hospedagem. Defina `NEXT_PUBLIC_SITE_URL` com o endereço público definitivo, por exemplo `https://sistema.seu-dominio.com.br`, antes de executar `npm run build`. Execute o build com `npm start` no servidor, ou publique em uma hospedagem compatível com Next.js.

O domínio deve apontar para a hospedagem e ter certificado HTTPS válido. No Supabase, configure **Authentication → URL Configuration → Site URL** com esse domínio e inclua `https://SEU-DOMINIO/auth/callback` entre as URLs de redirecionamento permitidas. Teste login e recuperação de senha no celular usando dados móveis. `localhost` só funciona no próprio dispositivo; metadados de SEO não tornam um servidor local acessível pela internet.

A página de login possui título, descrição, URL canônica e metadados para compartilhamento. O sitemap inclui somente essa página pública quando `NEXT_PUBLIC_SITE_URL` está configurada. As telas internas e os orçamentos não são indexáveis por padrão; a autenticação continua responsável por controlar o acesso. As convenções de metadados seguem a [documentação do Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).

Para liberar a edição de compras, aplique também a migração descrita em [Estoque de matérias-primas](docs/estoque-materias-primas.md#editar-compras-já-lançadas).
