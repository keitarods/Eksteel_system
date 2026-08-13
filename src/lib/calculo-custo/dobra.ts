// Custo de dobra: modelo "valor por dobra" (fixo), não hora-máquina — pesquisa de
// mercado indicou que em lote pequeno o preço é dominado pelo setup (troca de
// ferramental, programação), não pelo tempo de operação em si, então cobrança
// por dobra é o método mais comum no mercado pra esse porte de serviço.
export function calcularCustoDobra(numeroDobras: number, valorPorDobra: number): number {
  return Math.max(0, numeroDobras) * valorPorDobra;
}
