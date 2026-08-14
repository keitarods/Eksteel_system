// Custo de dobra: tempo × CHM da dobradeira. Substituiu o modelo anterior
// (valor fixo por dobra) depois de um caso real mostrar que ele superestimava
// muito peças finas — dobra em chapa fina tem tempo de execução bem menor que
// em chapa grossa, e um valor fixo por evento não captura essa diferença.
// `tempoPadraoDobraSeg` é um valor único (v1) — evoluir pra lookup por
// espessura/comprimento aqui dentro quando houver histórico real suficiente
// pra calibrar a diferença, sem precisar mexer em quem chama esta função.
export function calcularTempoDobraSeg(numeroDobras: number, tempoPadraoDobraSeg: number): number {
  return Math.max(0, numeroDobras) * tempoPadraoDobraSeg;
}

export function calcularCustoDobra(tempoTotalDobraSeg: number, horaMaquinaDobra: number): number {
  return (tempoTotalDobraSeg / 3600) * horaMaquinaDobra;
}
