import type { SupabaseClient } from "@supabase/supabase-js";

export type EmpresaConfig = {
  id: string;
  razaoSocial: string;
  endereco: string;
  telefone: string;
  email: string;
  site: string;
};

// Usado quando a tabela empresa_config ainda não tem nenhuma linha (ex: antes da
// migration ser rodada) — pra o PDF e a tela pública não quebrarem nesse meio-tempo.
export const EMPRESA_PADRAO: EmpresaConfig = {
  id: "",
  razaoSocial: "Eksteel Soluções em Aço",
  endereco: "",
  telefone: "",
  email: "",
  site: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmpresaConfig(r: any): EmpresaConfig {
  return {
    id: String(r.id),
    razaoSocial: String(r.razao_social ?? ""),
    endereco: String(r.endereco ?? ""),
    telefone: String(r.telefone ?? ""),
    email: String(r.email ?? ""),
    site: String(r.site ?? ""),
  };
}

// A empresa é uma linha só (singleton) — se por algum motivo houver mais de uma,
// usa a mais recentemente atualizada.
export async function buscarEmpresaConfig(supabase: SupabaseClient): Promise<EmpresaConfig> {
  const { data } = await supabase
    .from("empresa_config")
    .select("*")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapEmpresaConfig(data) : EMPRESA_PADRAO;
}

export async function salvarEmpresaConfig(
  supabase: SupabaseClient,
  usuarioId: string,
  id: string,
  dados: Omit<EmpresaConfig, "id">
): Promise<{ error: string | null }> {
  const payload = {
    razao_social: dados.razaoSocial.trim(),
    endereco: dados.endereco.trim(),
    telefone: dados.telefone.trim(),
    email: dados.email.trim(),
    site: dados.site.trim(),
    atualizado_por: usuarioId,
    atualizado_em: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("empresa_config").update(payload).eq("id", id);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.from("empresa_config").insert(payload);
  return { error: error?.message ?? null };
}

// ─── CNPJs da empresa (lista, ex: MEI do Matheus, MEI do Enyo) ───
// Cada orçamento escolhe um na hora de criar/editar; o texto escolhido fica
// salvo no próprio orçamento (não é uma referência viva a essa tabela).

export type EmpresaCnpj = { id: string; label: string; cnpj: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmpresaCnpj(r: any): EmpresaCnpj {
  return { id: String(r.id), label: String(r.label ?? ""), cnpj: String(r.cnpj ?? "") };
}

export async function listarEmpresaCnpjs(supabase: SupabaseClient): Promise<EmpresaCnpj[]> {
  const { data } = await supabase.from("empresa_cnpjs").select("*").order("criado_em");
  return (data ?? []).map(mapEmpresaCnpj);
}

export async function criarEmpresaCnpj(
  supabase: SupabaseClient,
  usuarioId: string,
  label: string,
  cnpj: string
): Promise<{ cnpj: EmpresaCnpj | null; error: string | null }> {
  const { data, error } = await supabase
    .from("empresa_cnpjs")
    .insert({ criado_por: usuarioId, label: label.trim(), cnpj: cnpj.trim() })
    .select()
    .single();
  return { cnpj: data ? mapEmpresaCnpj(data) : null, error: error?.message ?? null };
}

export async function atualizarEmpresaCnpj(
  supabase: SupabaseClient,
  id: string,
  label: string,
  cnpj: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("empresa_cnpjs")
    .update({ label: label.trim(), cnpj: cnpj.trim() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function excluirEmpresaCnpj(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("empresa_cnpjs").delete().eq("id", id);
  return { error: error?.message ?? null };
}
