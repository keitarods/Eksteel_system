export type Material = { custo_medio?: number | null; custo_medio_estimado?: boolean; id: string; nome: string; codigo: string; unidade: string; ativo: boolean; influencia_saldo: boolean; saldo: number; entradas: number; saidas: number };
export type ProdutoEstoque = { custo?: number; custo_medio?: number | null; custo_medio_estimado?: boolean; id: string; nome: string; codigo: string; ativo: boolean; estoque_atual: number };
export type Componente = { produto_id: string; materia_prima_id: string | null; nome_peca: string; quantidade: number };
export type ItemKit = { kit_id: string; produto_id: string; quantidade: number };
export type Necessidade = { id: string; nome: string; unidade: string; quantidade: number; saldo: number; limita: boolean; ativo: boolean };
export type Disponibilidade = { saldo: number; usaMateriais: boolean; necessidades: Necessidade[]; problemas: string[] };

// Agrupa antes de dividir: dois produtos do kit podem disputar a mesma chapa.
export function calcularDisponibilidade(itens: { produto_id: string; quantidade: number }[], produtos: ProdutoEstoque[], componentes: Componente[], materiais: Material[]): Disponibilidade {
  const necessidades = new Map<string, Necessidade>();
  const problemas: string[] = [];
  let usaMateriais = false;
  const quantidades = new Map<string, number>();
  for (const item of itens) {
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) { problemas.push("Quantidade inválida na composição."); continue; }
    quantidades.set(item.produto_id, (quantidades.get(item.produto_id) ?? 0) + item.quantidade);
  }
  function somar(n: Necessidade) {
    const anterior = necessidades.get(n.id);
    necessidades.set(n.id, { ...n, quantidade: n.quantidade + (anterior?.quantidade ?? 0) });
  }
  for (const [id, quantidade] of quantidades) {
    const produto = produtos.find(p => p.id === id);
    if (!produto || !produto.ativo) { problemas.push(`${produto?.nome ?? "Produto"}: inexistente ou inativo.`); continue; }
    const comps = componentes.filter(c => c.produto_id === id);
    if (!comps.length) {
      somar({ id: `produto:${id}`, nome: produto.nome, unidade: "un", quantidade, saldo: produto.estoque_atual, limita: true, ativo: true });
      continue;
    }
    usaMateriais = true;
    let limitadores = 0;
    for (const c of comps) {
      const mp = materiais.find(m => m.id === c.materia_prima_id);
      if (!mp || !Number.isFinite(c.quantidade) || c.quantidade <= 0) { problemas.push(`${produto.nome}: vincule ${c.nome_peca || "o componente"} a uma matéria-prima e informe quantidade válida.`); continue; }
      if (mp.influencia_saldo) limitadores++;
      somar({ id: mp.id, nome: mp.nome, unidade: mp.unidade, quantidade: c.quantidade * quantidade, saldo: Number(mp.saldo), limita: mp.influencia_saldo, ativo: mp.ativo });
    }
    if (!limitadores) problemas.push(`${produto.nome}: marque ao menos um componente que influencia o saldo.`);
  }
  const lista = [...necessidades.values()];
  const limites = lista.filter(n => n.limita).map(n => n.ativo ? Math.max(0, Math.floor((n.saldo + 1e-9) / n.quantidade)) : 0);
  return { saldo: problemas.length || !limites.length ? 0 : Math.min(...limites), usaMateriais, necessidades: lista, problemas };
}

export function faltas(d: Disponibilidade, quantidade = 1) {
  return d.necessidades.filter(n => !n.ativo || n.saldo + 1e-9 < n.quantidade * quantidade).map(n => ({ ...n, faltante: Math.max(0, n.quantidade * quantidade - (n.ativo ? n.saldo : 0)) }));
}

export type CustoComposicao = {
  total: number | null;
  estimado: boolean;
  itens: { id: string; nome: string; quantidade: number; unidade: string; custoUnitario: number | null; subtotal: number | null }[];
};

export type MovimentoPreco = { id: string; materia_prima_id: string | null; referencia_id?: string | null; tipo: string; quantidade: number; custo_informado?: number | null; data: string; criado_em: string };

/** Última entrada com preço explícito, pela data da movimentação. */
export function ultimosPrecosMateriais(movimentos: MovimentoPreco[]): Map<string, number> {
  const canceladas = new Set(movimentos.filter(m => m.tipo === "estorno_compra" && m.referencia_id).map(m => m.referencia_id));
  const precos = new Map<string, number>();
  const entradas = movimentos.filter(m => m.materia_prima_id && ["compra", "entrada", "ajuste"].includes(m.tipo)
    && Number(m.quantidade) > 0 && m.custo_informado != null && Number.isFinite(Number(m.custo_informado)) && Number(m.custo_informado) >= 0
    && !(m.tipo === "compra" && m.referencia_id && canceladas.has(m.referencia_id)));
  entradas.sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em) || b.id.localeCompare(a.id));
  for (const m of entradas) if (!precos.has(m.materia_prima_id!)) precos.set(m.materia_prima_id!, Number(m.custo_informado));
  return precos;
}

export function calcularUltimoCustoComposicao(itens: { produto_id: string; quantidade: number }[], produtos: ProdutoEstoque[], componentes: Componente[], materiais: Material[], precos: Map<string, number>): CustoComposicao {
  const custo = calcularCustoComposicao(itens, produtos.map(p => ({ ...p, custo: undefined, custo_medio: null })), componentes,
    materiais.map(m => ({ ...m, custo_medio: precos.get(m.id) ?? null })));
  // Sem preço de todos os componentes, não apresentar uma soma parcial como custo completo.
  return { ...custo, total: custo.itens.some(i => i.subtotal === null) ? null : custo.total };
}

/** Inclui TODOS os materiais, mesmo os que não limitam disponibilidade. */
export function calcularCustoComposicao(itens: { produto_id: string; quantidade: number }[], produtos: ProdutoEstoque[], componentes: Componente[], materiais: Material[]): CustoComposicao {
  const parcelas: CustoComposicao["itens"] = [];
  let completo = itens.length > 0;
  let estimado = false;
  let estruturaValida = itens.length > 0;
  for (const item of itens) {
    const produto = produtos.find(p => p.id === item.produto_id);
    if (!produto || !Number.isFinite(item.quantidade) || item.quantidade <= 0) { completo = false; estruturaValida = false; continue; }
    const comps = componentes.filter(c => c.produto_id === produto.id);
    if (!comps.length) {
      const custo = produto.custo_medio ?? (Number(produto.custo) > 0 ? Number(produto.custo) : null);
      const valido = custo != null && Number.isFinite(custo) && custo >= 0;
      parcelas.push({ id: `produto:${produto.id}`, nome: produto.nome, quantidade: item.quantidade, unidade: "un", custoUnitario: valido ? custo : null, subtotal: valido ? custo * item.quantidade : null });
      completo &&= valido; estimado ||= produto.custo_medio_estimado !== false;
    } else for (const c of comps) {
      const m = materiais.find(m => m.id === c.materia_prima_id);
      const quantidade = c.quantidade * item.quantidade;
      const custo = m?.custo_medio;
      const valido = Number.isFinite(quantidade) && quantidade > 0 && custo != null && Number.isFinite(custo) && custo >= 0;
      estruturaValida &&= !!m && Number.isFinite(quantidade) && quantidade > 0;
      completo &&= valido;
      estimado ||= m?.custo_medio_estimado !== false || !m?.ativo || Number(m?.saldo ?? 0) < quantidade;
      parcelas.push({ id: m?.id ?? c.nome_peca, nome: m?.nome ?? c.nome_peca ?? "Componente sem vínculo", quantidade, unidade: m?.unidade ?? "", custoUnitario: custo ?? null, subtotal: valido ? quantidade * custo : null });
    }
  }
  // Agrupa o mesmo material entre produtos/linhas do kit.
  const agrupados = new Map<string, CustoComposicao["itens"][number]>();
  for (const p of parcelas) {
    const anterior = agrupados.get(p.id);
    agrupados.set(p.id, anterior ? { ...p, quantidade: anterior.quantidade + p.quantidade, subtotal: anterior.subtotal == null || p.subtotal == null ? null : anterior.subtotal + p.subtotal } : p);
  }
  const lista = [...agrupados.values()];
  for (const p of lista) {
    const m = materiais.find(m => m.id === p.id);
    if (m && Number(m.saldo) < p.quantidade) estimado = true;
  }
  return { total: estruturaValida && parcelas.some(p => p.subtotal !== null) ? parcelas.reduce((s, p) => s + (p.subtotal ?? 0), 0) : null, estimado: estimado || !completo, itens: lista };
}
