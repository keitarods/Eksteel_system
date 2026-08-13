import { parsearDxf } from "./parser-dxf";
import { discretizarEntidade } from "./discretizar";
import { encadearContornos } from "./contornos";
import { calcularAreaEPerimetro } from "./area-perimetro";
import { contarLinhasDeDobra } from "./dobras";
import type { ResultadoGeometria } from "../types";

export { parsearDxf } from "./parser-dxf";
export { discretizarEntidade } from "./discretizar";
export { encadearContornos } from "./contornos";
export { calcularAreaEPerimetro } from "./area-perimetro";
export { contornosParaSvg } from "./svg";
export { contarLinhasDeDobra } from "./dobras";

// Ponto de entrada único: texto de um DXF (2D) -> área, perímetro, bbox, furos e
// sugestão de número de dobras. Assume unidades do desenho em mm (padrão de
// fabricação metálica no Brasil).
export function calcularGeometriaDxf(conteudoDxf: string): ResultadoGeometria {
  const entidades = parsearDxf(conteudoDxf);
  const polylines = entidades.flatMap(discretizarEntidade);
  const contornos = encadearContornos(polylines);
  const resultado = calcularAreaEPerimetro(contornos);
  return { ...resultado, dobrasDetectadas: contarLinhasDeDobra(entidades) };
}
