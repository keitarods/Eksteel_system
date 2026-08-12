export type Ponto = { x: number; y: number };

export type Contorno = { pontos: Ponto[]; fechado: boolean };

export type ResultadoGeometria = {
  areaMm2: number;
  perimetroMm: number;
  bbox: { larguraMm: number; alturaMm: number };
  contornos: Contorno[];
  furos: number;
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

// Nomes das chaves em parametros_custo pra preço/densidade de cada material.
export function chavesParametroMaterial(material: string): { preco: string; densidade: string } {
  return { preco: `preco_kg_${material}`, densidade: `densidade_${material}` };
}

export type CalculoPeca = {
  id: string;
  nome: string;
  material: string;
  espessuraMm: number;
  pesoKg: number;
  custoMaterial: number;
  custoCorte: number;
  custoTotal: number;
  quantidade: number;
  criadoEm: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCalculoPeca(r: any): CalculoPeca {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    material: String(r.material ?? ""),
    espessuraMm: Number(r.espessura_mm ?? 0),
    pesoKg: Number(r.peso_kg ?? 0),
    custoMaterial: Number(r.custo_material ?? 0),
    custoCorte: Number(r.custo_corte ?? 0),
    custoTotal: Number(r.custo_total ?? 0),
    quantidade: Number(r.quantidade ?? 1),
    criadoEm: String(r.criado_em ?? ""),
  };
}
