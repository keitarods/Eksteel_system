import type { TempoSoldaPadrao } from "./parametros";

export type ProcessoSolda = "mig" | "tig";
export type PosicaoSolda = "plana" | "vertical" | "sobrecabeca";
export type TipoJunta = TempoSoldaPadrao["tipoJunta"];

export const PROCESSOS_SOLDA: { valor: ProcessoSolda; label: string }[] = [
  { valor: "mig", label: "MIG/MAG" },
  { valor: "tig", label: "TIG" },
];

export const TIPOS_JUNTA: { valor: TipoJunta; label: string }[] = [
  { valor: "filete", label: "Filete" },
  { valor: "topo", label: "Topo" },
  { valor: "sobreposicao", label: "Sobreposição" },
];

export const POSICOES_SOLDA: { valor: PosicaoSolda; label: string; multiplicador: number }[] = [
  { valor: "plana", label: "Plana", multiplicador: 1 },
  { valor: "vertical", label: "Vertical", multiplicador: 1.4 },
  { valor: "sobrecabeca", label: "Sobrecabeça", multiplicador: 1.8 },
];

// TIG é mais lento que MIG pra depositar o mesmo volume de solda — multiplicador
// sobre o tempo-base da tabela (que é calibrada em cima de MIG).
const MULTIPLICADOR_PROCESSO: Record<ProcessoSolda, number> = { mig: 1, tig: 1.6 };

// Interpola o tempo padrão (min/metro) da tabela de referência por espessura,
// dentro do mesmo tipo de junta — mesmo formato de interpolação de estimarVelocidadeCorte.
function interpolarTempoBase(tabela: TempoSoldaPadrao[], tipoJunta: TipoJunta, espessuraMm: number): number {
  const doTipo = tabela.filter((t) => t.tipoJunta === tipoJunta).sort((a, b) => a.espessuraMm - b.espessuraMm);
  if (doTipo.length === 0) return 0;
  if (espessuraMm <= doTipo[0].espessuraMm) return doTipo[0].tempoMinPorMetro;
  if (espessuraMm >= doTipo[doTipo.length - 1].espessuraMm) return doTipo[doTipo.length - 1].tempoMinPorMetro;

  for (let i = 0; i < doTipo.length - 1; i++) {
    const a = doTipo[i];
    const b = doTipo[i + 1];
    if (espessuraMm >= a.espessuraMm && espessuraMm <= b.espessuraMm) {
      const fracao = (espessuraMm - a.espessuraMm) / (b.espessuraMm - a.espessuraMm);
      return a.tempoMinPorMetro + fracao * (b.tempoMinPorMetro - a.tempoMinPorMetro);
    }
  }
  return doTipo[0].tempoMinPorMetro;
}

export function estimarTempoSoldaMin(
  tabela: TempoSoldaPadrao[],
  tipoJunta: TipoJunta,
  espessuraMm: number,
  comprimentoM: number,
  processo: ProcessoSolda,
  posicao: PosicaoSolda
): number {
  const tempoBaseMinM = interpolarTempoBase(tabela, tipoJunta, espessuraMm);
  const multPosicao = POSICOES_SOLDA.find((p) => p.valor === posicao)?.multiplicador ?? 1;
  return comprimentoM * tempoBaseMinM * MULTIPLICADOR_PROCESSO[processo] * multPosicao;
}

export function calcularCustoSolda(params: {
  tempoSoldaMin: number;
  horaSoldador: number;
  horaMaquinaSolda: number;
  consumoArameKgH: number;
  precoKgArame: number;
  custoGasHora: number;
}): { custoMaoDeObra: number; custoMaquina: number; custoConsumiveis: number; total: number } {
  const horas = params.tempoSoldaMin / 60;
  const custoMaoDeObra = horas * params.horaSoldador;
  const custoMaquina = horas * params.horaMaquinaSolda;
  const custoConsumiveis = horas * params.consumoArameKgH * params.precoKgArame + horas * params.custoGasHora;
  return { custoMaoDeObra, custoMaquina, custoConsumiveis, total: custoMaoDeObra + custoMaquina + custoConsumiveis };
}
