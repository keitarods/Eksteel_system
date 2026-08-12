export type ItemComposicao = { descricao: string; valor: number };

export type ResultadoComposicao = {
  itens: ItemComposicao[];
  subtotal: number;
  scrapValor: number;
  custoComScrap: number;
  margemValor: number;
  precoSugerido: number;
};

export function calcularComposicao(
  itens: ItemComposicao[],
  scrapFactorPercentual: number,
  margemLucroPercentual: number
): ResultadoComposicao {
  const subtotal = itens.reduce((s, i) => s + i.valor, 0);
  const scrapValor = subtotal * (scrapFactorPercentual / 100);
  const custoComScrap = subtotal + scrapValor;
  const margemValor = custoComScrap * (margemLucroPercentual / 100);
  const precoSugerido = custoComScrap + margemValor;
  return { itens, subtotal, scrapValor, custoComScrap, margemValor, precoSugerido };
}
