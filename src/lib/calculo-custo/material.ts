// Peso da peça (kg) = área (m²) × espessura (m) × densidade (kg/m³).
export function calcularPesoPeca(areaM2: number, espessuraMm: number, densidadeKgM3: number): number {
  const espessuraM = espessuraMm / 1000;
  return areaM2 * espessuraM * densidadeKgM3;
}

export function calcularCustoMaterial(pesoKg: number, precoPorKg: number): number {
  return pesoKg * precoPorKg;
}
