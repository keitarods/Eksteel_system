export type EquipamentoUsinagem =
  | "torno_convencional"
  | "torno_cnc"
  | "fresa_3eixos"
  | "fresa_4eixos"
  | "fresa_5eixos";

export const EQUIPAMENTOS_USINAGEM: { valor: EquipamentoUsinagem; label: string }[] = [
  { valor: "torno_convencional", label: "Torno convencional" },
  { valor: "torno_cnc", label: "Torno CNC" },
  { valor: "fresa_3eixos", label: "Fresa 3 eixos" },
  { valor: "fresa_4eixos", label: "Fresa 4 eixos" },
  { valor: "fresa_5eixos", label: "Fresa 5 eixos" },
];

// Nome da chave em parametros_custo pra hora-máquina de cada equipamento.
export function chaveHoraMaquinaUsinagem(equipamento: EquipamentoUsinagem): string {
  return `hora_maquina_${equipamento}`;
}

export type Complexidade = "simples" | "media" | "complexa";

export const COMPLEXIDADES: { valor: Complexidade; label: string }[] = [
  { valor: "simples", label: "Simples" },
  { valor: "media", label: "Média" },
  { valor: "complexa", label: "Complexa" },
];

// Multiplicador sobre o tempo-base editável (tempo_base_usinagem_min) — só usado
// no modo "estimado por complexidade", até acumular histórico real de apontamento.
const MULTIPLICADORES_COMPLEXIDADE: Record<Complexidade, number> = {
  simples: 1,
  media: 2.5,
  complexa: 5,
};

export function calcularTempoUsinagemMin(
  modo: "manual" | "estimado",
  tempoManualMin: number,
  tempoBaseMin: number,
  complexidade: Complexidade
): number {
  if (modo === "manual") return Math.max(0, tempoManualMin);
  return tempoBaseMin * MULTIPLICADORES_COMPLEXIDADE[complexidade];
}

export function calcularCustoMaterialUsinagem(pesoBrutoKg: number, precoKg: number, fatorPerdaPercentual: number): number {
  return pesoBrutoKg * precoKg * (1 + fatorPerdaPercentual / 100);
}

export function calcularCustoUsinagem(params: {
  tempoUsinagemMin: number;
  tempoSetupMin: number;
  quantidadeLote: number;
  horaMaquina: number;
  ferramentalHora: number;
}): { custoOperacao: number; custoSetupRateado: number; custoFerramental: number; total: number } {
  const horasOperacao = params.tempoUsinagemMin / 60;
  const horasSetup = params.tempoSetupMin / 60;
  const lote = Math.max(1, params.quantidadeLote);

  const custoOperacao = horasOperacao * params.horaMaquina;
  const custoSetupRateado = (horasSetup * params.horaMaquina) / lote;
  const custoFerramental = horasOperacao * params.ferramentalHora;

  return {
    custoOperacao,
    custoSetupRateado,
    custoFerramental,
    total: custoOperacao + custoSetupRateado + custoFerramental,
  };
}
