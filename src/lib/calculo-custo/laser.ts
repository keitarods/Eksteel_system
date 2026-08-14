import type { ProcessoCorte, VelocidadeCorte } from "./parametros";

// Apesar do nome do arquivo, serve os três processos de corte (laser, oxicorte,
// plasma) — a matemática de interpolação é idêntica, só muda a tabela filtrada
// por `processo`. "potência" é reaproveitada como amperagem nominal no plasma
// (oxicorte usa um valor fixo, já que não varia por "potência" do mesmo jeito).
export function estimarVelocidadeCorte(
  tabela: VelocidadeCorte[],
  processo: ProcessoCorte,
  material: string,
  espessuraMm: number,
  potenciaKw: number
): number {
  const doMaterial = tabela.filter((v) => v.processo === processo && v.material === material);
  if (doMaterial.length === 0) return 0;

  const potencias = Array.from(new Set(doMaterial.map((v) => v.potenciaKw))).sort((a, b) => a - b);
  const potenciaMaisProxima = potencias.reduce(
    (melhor, p) => (Math.abs(p - potenciaKw) < Math.abs(melhor - potenciaKw) ? p : melhor),
    potencias[0]
  );

  const pontos = doMaterial
    .filter((v) => v.potenciaKw === potenciaMaisProxima)
    .sort((a, b) => a.espessuraMm - b.espessuraMm);
  if (pontos.length === 0) return 0;

  if (espessuraMm <= pontos[0].espessuraMm) return pontos[0].velocidadeMMin;
  if (espessuraMm >= pontos[pontos.length - 1].espessuraMm) return pontos[pontos.length - 1].velocidadeMMin;

  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    if (espessuraMm >= a.espessuraMm && espessuraMm <= b.espessuraMm) {
      const fracao = (espessuraMm - a.espessuraMm) / (b.espessuraMm - a.espessuraMm);
      return a.velocidadeMMin + fracao * (b.velocidadeMMin - a.velocidadeMMin);
    }
  }
  return pontos[0].velocidadeMMin;
}

export function calcularTempoCorteMin(perimetroM: number, velocidadeMMin: number): number {
  if (velocidadeMMin <= 0) return 0;
  return perimetroM / velocidadeMMin;
}

export function calcularCustoCorte(tempoMin: number, valorHoraMaquina: number, custoGasHora = 0): number {
  const horas = tempoMin / 60;
  return horas * (valorHoraMaquina + custoGasHora);
}
