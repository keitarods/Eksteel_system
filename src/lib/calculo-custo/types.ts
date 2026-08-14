export type Ponto = { x: number; y: number };

export type Contorno = { pontos: Ponto[]; fechado: boolean };

export type ResultadoGeometria = {
  areaMm2: number;
  perimetroMm: number;
  bbox: { larguraMm: number; alturaMm: number };
  contornos: Contorno[];
  furos: number;
  // Sugestão heurística (camada do DXF), não uma leitura garantida — ver geometria/dobras.ts.
  dobrasDetectadas: number;
};

export const MATERIAIS = [
  { valor: "aco_carbono", label: "Aço carbono" },
  { valor: "inox_304", label: "Inox 304" },
  { valor: "inox_316", label: "Inox 316" },
  { valor: "aluminio", label: "Alumínio" },
  { valor: "galvanizado", label: "Galvanizado" },
] as const;

export type Material = (typeof MATERIAIS)[number]["valor"];

// Material usado pra buscar a tabela de velocidade de corte (não tem entrada própria
// pra 316/alumínio/galvanizado — usa a mesma família de aço inox ou carbono, conforme
// o comportamento térmico de corte for mais parecido).
export function materialParaVelocidadeCorte(material: string): "aco_carbono" | "inox" {
  return material === "inox_304" || material === "inox_316" ? "inox" : "aco_carbono";
}

export const POTENCIAS_LASER_KW = [1, 2, 3, 4, 6] as const;
export const AMPERAGENS_PLASMA_A = [40, 65, 105] as const;

// Custo de material varia pela forma do estoque comprado, não só pelo material em
// si — chapa de aço carbono não custa o mesmo por kg que metalon ou barra de
// usinagem do mesmo aço, por causa do processo/desperdício de cada forma. Por
// isso preço (e densidade, pra manter os dois no mesmo grupo editável) são
// namespaced por grupo de estoque, não uma chave global única por material.
// Oxicorte/plasma corta a mesma chapa plana do laser — usa o grupo "chapa"
// também, sem grupo próprio.
export type GrupoMaterial = "chapa" | "perfis" | "usinagem";

// Nomes das chaves em parametros_custo pra preço/densidade de um material dentro
// de um grupo de estoque.
export function chavesParametroMaterial(grupo: GrupoMaterial, material: string): { preco: string; densidade: string } {
  return { preco: `preco_kg_${grupo}_${material}`, densidade: `densidade_${grupo}_${material}` };
}

export const TIPOS_CALCULO = [
  { valor: "chapa_laser", label: "Chapa (laser)" },
  { valor: "chapa_oxicorte", label: "Chapa (oxicorte)" },
  { valor: "chapa_plasma", label: "Chapa (plasma)" },
  { valor: "torneamento", label: "Torneamento" },
  { valor: "fresamento", label: "Fresamento" },
  { valor: "soldagem", label: "Soldagem" },
  { valor: "cad_cae", label: "CAD/CAE" },
] as const;

export type TipoCalculo = (typeof TIPOS_CALCULO)[number]["valor"];

export type CalculoPeca = {
  id: string;
  nome: string;
  tipoCalculo: TipoCalculo;
  material: string;
  espessuraMm: number;
  pesoKg: number;
  custoMaterial: number;
  custoCorte: number;
  custoTotal: number;
  quantidade: number;
  parametrosEspecificos: Record<string, unknown>;
  criadoEm: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCalculoPeca(r: any): CalculoPeca {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    tipoCalculo: (r.tipo_calculo ?? "chapa_laser") as TipoCalculo,
    material: String(r.material ?? ""),
    espessuraMm: Number(r.espessura_mm ?? 0),
    pesoKg: Number(r.peso_kg ?? 0),
    custoMaterial: Number(r.custo_material ?? 0),
    custoCorte: Number(r.custo_corte ?? 0),
    custoTotal: Number(r.custo_total ?? 0),
    quantidade: Number(r.quantidade ?? 1),
    parametrosEspecificos: (r.parametros_especificos ?? {}) as Record<string, unknown>,
    criadoEm: String(r.criado_em ?? ""),
  };
}
