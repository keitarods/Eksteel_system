/** Indicadores gerenciais. Valores ausentes permanecem null; não são tratados como custo zero. */
export type ComponenteCmv = { produto_id: string; quantidade: number; custo_unitario: number | null };
export type VendaRelatorio = { cmvTotal?: number | null; cmvEstimado?: boolean; cmvComponentes?: ComponenteCmv[] | null; cmvRegistradoEm?: string; id: string; data: string; produtoId: string; produtoNome: string; kitId: string; marketplace: string; quantidade: number; valorUnitario: number; desconto: number; taxaMarketplace: number };
export type ProdutoRelatorio = { custoMedio?: number | null; custoMedioEstimado?: boolean; id: string; nome: string; codigo: string; custo: number; estoqueAtual: number; estoqueMinimo: number; ativo: boolean };
export type FabricacaoRelatorio = { id: string; produtoId: string; data: string; qtdFabricada: number; valorTotal: number };
export type DespesaRelatorio = { id: string; data: string; categoria: string; valor: number };
export type KitRelatorio = { id: string; nome: string; itens: { produtoId: string; quantidade: number }[] };
export type BaseGerencial = { vendas: VendaRelatorio[]; produtos: ProdutoRelatorio[]; fabricacoes: FabricacaoRelatorio[]; despesas: DespesaRelatorio[]; kits: KitRelatorio[] };
export type Periodo = { inicio: string; fim: string };
export const moeda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
export const dentro = (data: string, periodo: Periodo) => data >= periodo.inicio && data <= periodo.fim;
export function mesDeslocado(mes: string, delta: number) {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function fimMes(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
}
export function periodosRelatorio(mes: string, hoje: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || mes > hoje.slice(0, 7) || mes < "1900-01") throw new Error("Selecione um mês válido até o mês atual.");
  const fim = mes === hoje.slice(0, 7) ? hoje : fimMes(mes);
  const anterior = mesDeslocado(mes, -1);
  const fimAnterior = mes === hoje.slice(0, 7) ? `${anterior}-${String(Math.min(Number(hoje.slice(8)), Number(fimMes(anterior).slice(8)))).padStart(2, "0")}` : fimMes(anterior);
  return {
    mes: { inicio: `${mes}-01`, fim },
    anterior: { inicio: `${anterior}-01`, fim: fimAnterior },
    ano: { inicio: `${mesDeslocado(mes, -11)}-01`, fim },
    meses: Array.from({ length: 12 }, (_, i) => mesDeslocado(mes, i - 11)),
  };
}
export function variacao(atual: number, anterior: number): number | null {
  return anterior > 0 ? (atual - anterior) / anterior * 100 : null;
}
export function consumoVenda(venda: VendaRelatorio, kits: KitRelatorio[]) {
  if (venda.kitId) {
    const kit = kits.find((k) => k.id === venda.kitId);
    if (!kit?.itens.length || kit.itens.some((i) => !i.produtoId || i.quantidade <= 0)) return null;
    return kit.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade * venda.quantidade }));
  }
  return venda.produtoId ? [{ produtoId: venda.produtoId, quantidade: venda.quantidade }] : null;
}
/** Histórico gravado tem prioridade. Sem histórico, usa custo cadastral como estimativa explícita. */
export function prepararVendas(base: BaseGerencial) {
  return base.vendas.map((v) => {
    const gravado = Boolean(v.cmvRegistradoEm);
    const consumo = gravado ? v.cmvComponentes?.length ? v.cmvComponentes.map(i => ({ produtoId: i.produto_id, quantidade: Number(i.quantidade) })) : null : consumoVenda(v, base.kits);
    const custos = consumo?.map((i, index) => {
      const custo = gravado ? v.cmvComponentes?.[index]?.custo_unitario : base.produtos.find(p => p.id === i.produtoId)?.custo;
      return { ...i, custo: custo != null && (gravado ? custo >= 0 : custo > 0) ? moeda(Number(custo) * i.quantidade) : null };
    }) ?? [];
    const cpv = gravado ? v.cmvTotal ?? null : consumo && custos.every(i => i.custo !== null) ? moeda(custos.reduce((s,i) => s + (i.custo ?? 0),0)) : null;
    const bruta = moeda(v.quantidade * v.valorUnitario);
    return { ...v, bruta, aposDescontos: moeda(bruta - v.desconto), cpv, custos, consumo, estimado: !gravado || v.cmvEstimado !== false };
  });
}
export type VendaApurada = ReturnType<typeof prepararVendas>[number];
export function resumoPeriodo(vendas: VendaApurada[], despesas: DespesaRelatorio[], periodo: Periodo) {
  const selecionadas = vendas.filter((v) => dentro(v.data, periodo));
  const gastos = despesas.filter((d) => dentro(d.data, periodo));
  const bruta = moeda(selecionadas.reduce((s, v) => s + v.bruta, 0));
  const descontos = moeda(selecionadas.reduce((s, v) => s + v.desconto, 0));
  const taxas = moeda(selecionadas.reduce((s, v) => s + v.taxaMarketplace, 0));
  const receita = moeda(bruta - descontos);
  const semCusto = selecionadas.filter((v) => v.cpv === null).length;
  const cpvConhecido = moeda(selecionadas.reduce((s, v) => s + (v.cpv ?? 0), 0));
  const cpv = semCusto ? null : cpvConhecido;
  const despesasTotal = moeda(gastos.reduce((s, d) => s + d.valor, 0));
  const brutoEstimado = cpv === null ? null : moeda(receita - cpv);
  const resultado = brutoEstimado === null ? null : moeda(brutoEstimado - taxas - despesasTotal);
  return {
    bruta, descontos, receita, receitaLiquidaGerencial: moeda(receita - taxas), taxas, cpv, cpvConhecido, despesasTotal, brutoEstimado, resultado, semCusto, custosEstimados: selecionadas.filter(v => v.estimado).length,
    quantidade: selecionadas.reduce((s, v) => s + v.quantidade, 0),
    lancamentos: selecionadas.length,
    valorMedio: selecionadas.length ? moeda(receita / selecionadas.length) : null,
    margem: resultado !== null && receita > 0 ? resultado / receita * 100 : null,
    margemBruta: brutoEstimado !== null && receita > 0 ? brutoEstimado / receita * 100 : null,
    taxaEfetiva: receita > 0 ? taxas / receita * 100 : null,
    despesasTaxas: moeda(gastos.filter((d) => d.categoria === "Taxas marketplace").reduce((s, d) => s + d.valor, 0)),
    vendasKit: selecionadas.filter((v) => v.kitId).length,
    deducoesExcessivas: selecionadas.filter((v) => v.desconto + v.taxaMarketplace > v.bruta).length,
  };
}
export function rankingItens(vendas: VendaApurada[], base: BaseGerencial, periodo: Periodo) {
  const itens = new Map<string, { id: string; nome: string; tipo: string; quantidade: number; receita: number; taxas: number; cpv: number | null }>();
  for (const v of vendas.filter((x) => dentro(x.data, periodo))) {
    const id = v.kitId ? `kit:${v.kitId}` : `produto:${v.produtoId || v.produtoNome || v.id}`;
    const nome = v.kitId ? base.kits.find((k) => k.id === v.kitId)?.nome : base.produtos.find((p) => p.id === v.produtoId)?.nome;
    const item = itens.get(id) ?? { id, nome: nome || v.produtoNome || "Item sem cadastro disponível", tipo: v.kitId ? "Kit" : "Produto", quantidade: 0, receita: 0, taxas: 0, cpv: 0 };
    item.quantidade += v.quantidade; item.receita += v.aposDescontos; item.taxas += v.taxaMarketplace;
    item.cpv = item.cpv === null || v.cpv === null ? null : item.cpv + v.cpv;
    itens.set(id, item);
  }
  const porReceita = [...itens.values()].sort((a, b) => b.receita - a.receita || a.id.localeCompare(b.id));
  const totalPositivo = porReceita.reduce((s, i) => s + Math.max(0, i.receita), 0);
  let acumulado = 0;
  const classificadas = porReceita.map((i) => {
    const abc = totalPositivo <= 0 || i.receita <= 0 ? "—" : acumulado / totalPositivo < .8 ? "A" : acumulado / totalPositivo < .95 ? "B" : "C";
    acumulado += Math.max(0, i.receita);
    return { ...i, receita: moeda(i.receita), abc, participacao: totalPositivo > 0 ? Math.max(0, i.receita) / totalPositivo * 100 : null, contribuicao: i.cpv === null ? null : moeda(i.receita - i.taxas - i.cpv) };
  });
  return classificadas.sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita || a.id.localeCompare(b.id));
}
export function posicaoEstoque(base: BaseGerencial, vendas: VendaApurada[], hoje: string) {
  const periodos = periodosRelatorio(hoje.slice(0, 7), hoje);
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${periodos.ano.inicio}T00:00:00Z`)) / 86400000 + 1;
  const saidas = new Map<string, number>();
  let kitsSemComposicao = 0;
  for (const v of vendas.filter((v) => dentro(v.data, periodos.ano))) {
    if (!v.consumo) kitsSemComposicao++;
    for (const i of v.consumo ?? []) saidas.set(i.produtoId, (saidas.get(i.produtoId) ?? 0) + i.quantidade);
  }
  const itens = base.produtos.filter((p) => p.ativo || p.estoqueAtual !== 0).map((p) => {
    const custo = p.custoMedio != null && p.custoMedio > 0 ? p.custoMedio : p.custo > 0 ? p.custo : null;
    const demanda = saidas.get(p.id) ?? 0;
    const valor = p.estoqueAtual === 0 ? 0 : p.estoqueAtual < 0 || custo === null ? null : moeda(p.estoqueAtual * custo);
    return { ...p, custo, valor, fonte: p.custoMedio != null && p.custoMedio > 0 ? p.custoMedioEstimado === false ? "Custo médio de reposição" : "Custo médio com saldo inicial estimado" : p.custo > 0 ? "Custo cadastral estimado" : "Sem custo", saidas: demanda, cobertura: kitsSemComposicao || p.estoqueAtual < 0 || !demanda ? null : p.estoqueAtual / (demanda / dias) };
  });
  const parcial = moeda(itens.reduce((s, p) => s + (p.valor ?? 0), 0));
  return { itens, parcial, total: itens.some((i) => i.valor === null) ? null : parcial, semValor: itens.filter((i) => i.valor === null).length, kitsSemComposicao, dias };
}
export function agruparValores<T>(itens: T[], chave: (item: T) => string, valor: (item: T) => number) {
  const mapa = new Map<string, number>();
  for (const i of itens) mapa.set(chave(i), (mapa.get(chave(i)) ?? 0) + valor(i));
  return [...mapa].map(([nome, total]) => ({ nome, total: moeda(total) })).sort((a, b) => b.total - a.total);
}
export function gerarCsv(linhas: (string | number | null)[][]) {
  return '\uFEFF' + linhas.map((linha) => linha.map((valor) => {
    let texto = valor === null ? "" : String(valor);
    if (typeof valor === "string" && /^[\s]*[=+@\-]|^[\t\r\n]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replaceAll('"', '""') + '"';
  }).join(';')).join('\r\n');
}
