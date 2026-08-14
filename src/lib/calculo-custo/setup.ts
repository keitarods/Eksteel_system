// Custo de preparação de máquina (setup) — não é custo por peça, é custo do
// pedido inteiro, rateado pela quantidade do lote. Peça avulsa (quantidade 1)
// carrega o setup cheio; lote grande dilui naturalmente, sem precisar de um
// fator artificial multiplicando o custo de produção.
export function calcularCustoSetupChapa(params: {
  tempoSetupLaserMin: number;
  horaMaquinaLaser: number;
  incluiDobra: boolean;
  tempoSetupDobraMin: number;
  horaMaquinaDobra: number;
  quantidade: number;
}): { custoSetupTotal: number; custoSetupPorPeca: number } {
  const custoSetupLaser = (params.tempoSetupLaserMin / 60) * params.horaMaquinaLaser;
  const custoSetupDobra = params.incluiDobra ? (params.tempoSetupDobraMin / 60) * params.horaMaquinaDobra : 0;
  const custoSetupTotal = custoSetupLaser + custoSetupDobra;
  const lote = Math.max(1, params.quantidade);
  return { custoSetupTotal, custoSetupPorPeca: custoSetupTotal / lote };
}
