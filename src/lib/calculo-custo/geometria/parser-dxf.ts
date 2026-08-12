import DxfParser from "dxf-parser";
import type { IEntity } from "dxf-parser";

// Wrapper fino sobre dxf-parser: só extrai as entidades brutas. Toda a álgebra
// geométrica (discretização, encadeamento de contornos, área/perímetro) fica em
// funções puras separadas, testáveis sem depender do parser.
export function parsearDxf(conteudoDxf: string): IEntity[] {
  const parser = new DxfParser();
  const dxf = parser.parseSync(conteudoDxf);
  if (!dxf) {
    throw new Error("Não foi possível ler o arquivo DXF — verifique se o arquivo não está corrompido.");
  }
  return dxf.entities ?? [];
}
