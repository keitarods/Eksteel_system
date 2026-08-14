import type { SupabaseClient } from "@supabase/supabase-js";

export type NivelResponsabilidadeCad = {
  id: string;
  nome: string;
  multiplicadorHora: number;
  exigeArt: boolean;
  descricao: string;
  ativo: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNivelResponsabilidadeCad(r: any): NivelResponsabilidadeCad {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    multiplicadorHora: Number(r.multiplicador_hora ?? 0),
    exigeArt: Boolean(r.exige_art),
    descricao: String(r.descricao ?? ""),
    ativo: Boolean(r.ativo),
  };
}

// Catálogo editável (criar/editar/desativar), não versionado por data — diferente
// de parametros_custo/velocidades_corte, não existe "nível de ontem vs. hoje".
export async function buscarNiveisResponsabilidadeCad(supabase: SupabaseClient): Promise<NivelResponsabilidadeCad[]> {
  const { data } = await supabase.from("niveis_responsabilidade_cad").select("*").order("multiplicador_hora");
  return (data ?? []).map(mapNivelResponsabilidadeCad);
}

// Método "Fator K": hora técnica não é só salário ÷ horas, embute encargos/
// impostos/férias/13º via um multiplicador sobre o salário de referência.
export function calcularHoraTecnicaBase(salarioReferencia: number, fatorK: number, horasProdutivasMes: number): number {
  if (horasProdutivasMes <= 0) return 0;
  return (salarioReferencia * fatorK) / horasProdutivasMes;
}

export function calcularCustoHoraNivel(horaTecnicaBase: number, multiplicadorHora: number): number {
  return horaTecnicaBase * multiplicadorHora;
}

export function calcularCustoCadCae(params: {
  horasEstimadas: number;
  horasRevisaoExtra: number;
  custoHoraNivel: number;
  incluirArt: boolean;
  valorArtReferencia: number;
}): { custoHoras: number; custoRevisoes: number; custoArt: number; total: number } {
  const custoHoras = Math.max(0, params.horasEstimadas) * params.custoHoraNivel;
  const custoRevisoes = Math.max(0, params.horasRevisaoExtra) * params.custoHoraNivel;
  const custoArt = params.incluirArt ? params.valorArtReferencia : 0;
  return { custoHoras, custoRevisoes, custoArt, total: custoHoras + custoRevisoes + custoArt };
}
