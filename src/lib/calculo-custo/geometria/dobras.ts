import type { IEntity } from "dxf-parser";

// Heurística: quando o desenho vem de um "flat pattern" de sheet metal (SolidWorks,
// Inventor, Fusion360...), o CAD frequentemente exporta as linhas de dobra numa
// camada (layer) separada das linhas de corte — mas o NOME da camada é definido
// pelo usuário/mapeamento de export, não é padronizado. Isso é só uma sugestão
// (pré-preenche o campo "número de dobras", que continua editável) — não uma
// leitura garantida. Não tenta ler PDF/GLB: ver conversa/plano pra justificativa.
const PADROES_CAMADA_DOBRA = [/bend/i, /dobra/i, /fold/i, /vinco/i, /crease/i];

export function contarLinhasDeDobra(entidades: IEntity[]): number {
  return entidades.filter((e) => {
    const layer = (e as { layer?: string }).layer ?? "";
    return PADROES_CAMADA_DOBRA.some((re) => re.test(layer));
  }).length;
}
