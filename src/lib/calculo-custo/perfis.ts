export type TipoPerfil = "redondo" | "quadrado" | "retangular" | "cantoneira" | "u" | "chapa_dobrada";

export const TIPOS_PERFIL: { valor: TipoPerfil; label: string }[] = [
  { valor: "redondo", label: "Tubo redondo" },
  { valor: "quadrado", label: "Tubo quadrado" },
  { valor: "retangular", label: "Tubo retangular" },
  { valor: "cantoneira", label: "Cantoneira" },
  { valor: "u", label: 'Perfil "U"' },
  { valor: "chapa_dobrada", label: "Chapa dobrada" },
];

// Área de seção transversal (mm²) de um perfil oco/maciço, por tipo. Todas as
// dimensões de entrada em mm.
export function areaSecaoTransversal(
  tipo: TipoPerfil,
  dimensaoA: number,
  dimensaoB: number | null,
  espessuraParede: number
): number {
  switch (tipo) {
    case "redondo": {
      const raioExterno = dimensaoA / 2;
      const raioInterno = Math.max(0, raioExterno - espessuraParede);
      return Math.PI * (raioExterno ** 2 - raioInterno ** 2);
    }
    case "quadrado": {
      const interno = Math.max(0, dimensaoA - 2 * espessuraParede);
      return dimensaoA ** 2 - interno ** 2;
    }
    case "retangular": {
      const b = dimensaoB ?? dimensaoA;
      const internoA = Math.max(0, dimensaoA - 2 * espessuraParede);
      const internoB = Math.max(0, b - 2 * espessuraParede);
      return dimensaoA * b - internoA * internoB;
    }
    case "cantoneira": {
      // Duas abas iguais de comprimento dimensaoA, espessura espessuraParede,
      // descontando a sobreposição no canto.
      return 2 * dimensaoA * espessuraParede - espessuraParede ** 2;
    }
    case "u": {
      const alma = dimensaoA;
      const aba = dimensaoB ?? dimensaoA / 2;
      return alma * espessuraParede + 2 * (aba - espessuraParede) * espessuraParede;
    }
    case "chapa_dobrada": {
      // Aproximação: comprimento total desenvolvido (dimensaoA) × espessura da chapa.
      return dimensaoA * espessuraParede;
    }
    default:
      return 0;
  }
}

export function calcularPesoPorMetro(areaSecaoMm2: number, densidadeKgM3: number): number {
  const areaM2 = areaSecaoMm2 / 1e6;
  return areaM2 * densidadeKgM3;
}

export function calcularCustoPerfil(pesoPorMetroKg: number, comprimentoM: number, precoPorKg: number): number {
  return pesoPorMetroKg * comprimentoM * precoPorKg;
}

export type PerfilMetalico = {
  id: string;
  tipo: TipoPerfil;
  nome: string;
  dimensaoA: number;
  dimensaoB: number | null;
  espessuraParede: number;
  material: string;
  pesoMetro: number | null;
  precoReferenciaMetro: number | null;
  favorito: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPerfilMetalico(r: any): PerfilMetalico {
  return {
    id: String(r.id),
    tipo: (r.tipo ?? "quadrado") as TipoPerfil,
    nome: String(r.nome ?? ""),
    dimensaoA: Number(r.dimensao_a ?? 0),
    dimensaoB: r.dimensao_b === null || r.dimensao_b === undefined ? null : Number(r.dimensao_b),
    espessuraParede: Number(r.espessura_parede ?? 0),
    material: String(r.material ?? "aco_carbono"),
    pesoMetro: r.peso_metro === null || r.peso_metro === undefined ? null : Number(r.peso_metro),
    precoReferenciaMetro:
      r.preco_referencia_metro === null || r.preco_referencia_metro === undefined
        ? null
        : Number(r.preco_referencia_metro),
    favorito: Boolean(r.favorito),
  };
}

// Peso/metro "efetivo": usa o valor salvo no catálogo se houver (override
// manual, ex. valor de catálogo do fabricante), senão calcula pela fórmula.
export function pesoMetroEfetivo(perfil: Pick<PerfilMetalico, "tipo" | "dimensaoA" | "dimensaoB" | "espessuraParede" | "pesoMetro">, densidadeKgM3: number): number {
  if (perfil.pesoMetro !== null) return perfil.pesoMetro;
  const area = areaSecaoTransversal(perfil.tipo, perfil.dimensaoA, perfil.dimensaoB, perfil.espessuraParede);
  return calcularPesoPorMetro(area, densidadeKgM3);
}
