/** URL pública definitiva, configurada no ambiente de produção. */
export function siteUrl(): URL | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return undefined;
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("NEXT_PUBLIC_SITE_URL deve usar HTTP ou HTTPS");
  return new URL(url.origin);
}
export const siteDescription = "Gestão financeira e operacional da Eksteel: compras, estoque, vendas, orçamentos e atividades da equipe em um só lugar.";
