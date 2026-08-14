import type { SupabaseClient } from "@supabase/supabase-js";

export type Parametro = {
  chave: string;
  valor: number;
  unidade: string;
  descricao: string;
  vigenteDesde: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapParametro(r: any): Parametro {
  return {
    chave: String(r.chave),
    valor: Number(r.valor),
    unidade: String(r.unidade ?? ""),
    descricao: String(r.descricao ?? ""),
    vigenteDesde: String(r.vigente_desde ?? ""),
  };
}

// A tabela parametros_custo nunca sofre UPDATE — reajustar um valor é inserir uma
// linha nova com a mesma chave e vigente_desde mais recente. "Valor atual" é
// sempre a linha mais recente de cada chave com vigente_desde <= hoje.
export async function buscarParametrosVigentes(supabase: SupabaseClient): Promise<Record<string, Parametro>> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("parametros_custo")
    .select("*")
    .lte("vigente_desde", hoje)
    .order("vigente_desde", { ascending: false });

  const porChave: Record<string, Parametro> = {};
  (data ?? []).forEach((r) => {
    const p = mapParametro(r);
    if (!porChave[p.chave]) porChave[p.chave] = p;
  });
  return porChave;
}

export type ProcessoCorte = "laser" | "oxicorte" | "plasma";

export type VelocidadeCorte = {
  material: string;
  espessuraMm: number;
  potenciaKw: number;
  velocidadeMMin: number;
  processo: ProcessoCorte;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVelocidade(r: any): VelocidadeCorte {
  return {
    material: String(r.material),
    espessuraMm: Number(r.espessura_mm),
    potenciaKw: Number(r.potencia_kw),
    velocidadeMMin: Number(r.velocidade_m_min),
    processo: (r.processo ?? "laser") as ProcessoCorte,
  };
}

export async function buscarVelocidadesCorte(supabase: SupabaseClient): Promise<VelocidadeCorte[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("velocidades_corte").select("*").lte("vigente_desde", hoje);

  // Mesma lógica de "última vigência", mas por combinação processo+material+espessura+potência.
  const porChave: Record<string, VelocidadeCorte> = {};
  (data ?? [])
    .map(mapVelocidade)
    .forEach((v) => {
      const chave = `${v.processo}|${v.material}|${v.espessuraMm}|${v.potenciaKw}`;
      if (!porChave[chave]) porChave[chave] = v;
    });
  return Object.values(porChave);
}

export type TempoSoldaPadrao = {
  tipoJunta: "topo" | "filete" | "sobreposicao";
  espessuraMm: number;
  tempoMinPorMetro: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTempoSolda(r: any): TempoSoldaPadrao {
  return {
    tipoJunta: (r.tipo_junta ?? "filete") as TempoSoldaPadrao["tipoJunta"],
    espessuraMm: Number(r.espessura_mm),
    tempoMinPorMetro: Number(r.tempo_min_por_metro),
  };
}

export async function buscarTemposSoldaPadrao(supabase: SupabaseClient): Promise<TempoSoldaPadrao[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("tempos_solda_padrao").select("*").lte("vigente_desde", hoje);

  const porChave: Record<string, TempoSoldaPadrao> = {};
  (data ?? [])
    .map(mapTempoSolda)
    .forEach((t) => {
      const chave = `${t.tipoJunta}|${t.espessuraMm}`;
      if (!porChave[chave]) porChave[chave] = t;
    });
  return Object.values(porChave);
}
