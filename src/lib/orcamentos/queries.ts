import type { SupabaseClient } from "@supabase/supabase-js";
import { mapOrcamento, mapOrcamentoItem, type Orcamento, type OrcamentoItem } from "./types";

const SELECT_ORCAMENTO =
  "*, clientes_orcamento(nome, cnpj_cpf, telefone, email, endereco, cidade, uf)";

// Reaproveitado tanto pelas páginas autenticadas quanto pela rota pública e pela
// geração de PDF — aceita tanto o client SSR normal quanto o client de service role.
export async function buscarOrcamentoCompleto(
  supabase: SupabaseClient,
  id: string
): Promise<{ orcamento: Orcamento; itens: OrcamentoItem[] } | null> {
  const [{ data: orc }, { data: itensRaw }] = await Promise.all([
    supabase.from("orcamentos").select(SELECT_ORCAMENTO).eq("id", id).maybeSingle(),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem"),
  ]);
  if (!orc) return null;
  return {
    orcamento: mapOrcamento(orc),
    itens: (itensRaw ?? []).map(mapOrcamentoItem),
  };
}

export async function listarOrcamentos(supabase: SupabaseClient): Promise<Orcamento[]> {
  const { data } = await supabase
    .from("orcamentos")
    .select(SELECT_ORCAMENTO)
    .order("criado_em", { ascending: false })
    .limit(500);
  return (data ?? []).map(mapOrcamento);
}

// Usado pela calculadora de custos: cria um rascunho vazio (sem cliente ainda —
// cliente_id é opcional) pra já receber os itens calculados na hora.
export async function criarOrcamentoRascunho(
  supabase: SupabaseClient,
  usuarioId: string,
  tipo: Orcamento["tipo"] = "servico_engenharia"
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({
      criado_por: usuarioId,
      tipo,
      data_emissao: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

// Também usado pela calculadora de custos, no botão "Adicionar ao orçamento" —
// insere o item e recalcula subtotal/total do orçamento (a mesma lógica de
// OrcamentoForm, mas chamada fora do formulário de edição).
export async function adicionarItemAoOrcamento(
  supabase: SupabaseClient,
  params: {
    orcamentoId: string;
    tipoItem: "produto" | "servico";
    descricao: string;
    detalhamentoTecnico?: string;
    unidade?: string;
    quantidade: number;
    valorUnitario: number;
  }
): Promise<{ error: string | null }> {
  const { count } = await supabase
    .from("orcamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", params.orcamentoId);

  const { error } = await supabase.from("orcamento_itens").insert({
    orcamento_id: params.orcamentoId,
    tipo_item: params.tipoItem,
    descricao: params.descricao,
    detalhamento_tecnico: params.detalhamentoTecnico ?? "",
    unidade: params.unidade ?? "un",
    quantidade: params.quantidade,
    valor_unitario: params.valorUnitario,
    valor_total: params.quantidade * params.valorUnitario,
    ordem: count ?? 0,
  });
  if (error) return { error: error.message };

  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("valor_total")
    .eq("orcamento_id", params.orcamentoId);
  const subtotal = (itens ?? []).reduce((s, i) => s + Number(i.valor_total), 0);

  const { data: orc } = await supabase
    .from("orcamentos")
    .select("desconto")
    .eq("id", params.orcamentoId)
    .maybeSingle();
  const desconto = Number(orc?.desconto ?? 0);

  await supabase
    .from("orcamentos")
    .update({ subtotal, total: Math.max(0, subtotal - desconto) })
    .eq("id", params.orcamentoId);

  return { error: null };
}
