import { createClient } from "@/lib/supabase/client";
import type { BaseGerencial } from "./metricas";
import { paginar } from "./paginacao";

type Linha = Record<string, unknown> & { id: unknown };
export async function buscarTodasLinhas(client: ReturnType<typeof createClient>, tabela: string, select = "*", signal?: AbortSignal): Promise<Linha[]> {
  return paginar(async (inicio, fim) => {
    let query = client.from(tabela).select(select).order("id", { ascending: true }).range(inicio, fim);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(`Não foi possível carregar ${tabela}. Verifique a conexão e as permissões e tente novamente.`);
    if (!data) throw new Error(`Resposta incompleta ao carregar ${tabela}.`);
    return data as unknown as Linha[];
  });
}
export async function buscarKitsComItens(client: ReturnType<typeof createClient>) {
  const [kits, itens] = await Promise.all([buscarTodasLinhas(client, "kits"), buscarTodasLinhas(client, "kit_itens", "*, produtos(nome, codigo)")]);
  return kits.map((kit) => ({ ...kit, kit_itens: itens.filter((item) => item.kit_id === kit.id) }));
}
function numero(linha: Linha, campo: string, opcional = false) {
  const valor = linha[campo];
  if (opcional && (valor === null || valor === undefined)) return 0;
  const n = typeof valor === "number" || (typeof valor === "string" && valor.trim()) ? Number(valor) : NaN;
  if (!Number.isFinite(n)) throw new Error(`Registro ${String(linha.id)} contém ${campo} inválido. Corrija o cadastro antes de apurar.`);
  return n;
}
const texto = (l: Linha, c: string) => String(l[c] ?? "");
function data(l: Linha) {
  const d = texto(l, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) throw new Error(`Registro ${String(l.id)} com data inválida.`);
  return d;
}
export async function carregarBaseGerencial(signal?: AbortSignal): Promise<BaseGerencial> {
  const client = createClient();
  const [vendas, despesas, produtos, kits, itens] = await Promise.all(
    ["vendas", "despesas", "produtos", "kits", "kit_itens"].map((t) => buscarTodasLinhas(client, t, "*", signal)),
  );
  return {
    vendas: vendas.map((r) => ({ cmvTotal: r.cmv_total == null ? null : numero(r, "cmv_total"), cmvEstimado: r.cmv_estimado !== false, cmvComponentes: r.cmv_componentes as BaseGerencial["vendas"][number]["cmvComponentes"], cmvRegistradoEm: texto(r, "cmv_registrado_em"), id: texto(r, "id"), data: data(r), produtoId: texto(r, "produto_id"), produtoNome: texto(r, "produto_nome"), kitId: texto(r, "kit_id"), marketplace: texto(r, "marketplace") || "Outro", quantidade: numero(r, "quantidade"), valorUnitario: numero(r, "valor_unitario"), desconto: numero(r, "desconto", true), taxaMarketplace: numero(r, "taxa_marketplace", true) })),
    despesas: despesas.map((r) => ({ id: texto(r, "id"), data: data(r), categoria: texto(r, "categoria") || "Outros", valor: numero(r, "valor") })),
    produtos: produtos.map((r) => ({ id: texto(r, "id"), nome: texto(r, "nome"), codigo: texto(r, "codigo"), custoMedio: r.custo_medio == null ? null : numero(r, "custo_medio"), custoMedioEstimado: r.custo_medio_estimado !== false, custo: numero(r, "custo", true), estoqueAtual: numero(r, "estoque_atual"), estoqueMinimo: numero(r, "estoque_minimo", true), ativo: r.ativo !== false })),
    fabricacoes: [],
    kits: kits.map((r) => ({ id: texto(r, "id"), nome: texto(r, "nome"), itens: itens.filter((i) => i.kit_id === r.id).map((i) => ({ produtoId: texto(i, "produto_id"), quantidade: numero(i, "quantidade") })) })),
  };
}
