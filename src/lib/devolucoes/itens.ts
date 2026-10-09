export type ProdutoDevolucao = { id: string; codigo: string; nome: string };
export type VendaDevolucao = {
  id: string; data: string; produto_nome: string | null; produto_id: string | null;
  kit_id: string | null; marketplace: string; quantidade: number;
  valor_unitario: number; desconto: number | null;
  cmv_componentes: { produto_id: string; quantidade: number }[] | null;
};

export function itensDaVenda(venda: VendaDevolucao, produtos: ProdutoDevolucao[]) {
  const componentes = venda.kit_id
    ? venda.cmv_componentes
    : [{ produto_id: venda.produto_id, quantidade: Number(venda.quantidade) }];
  if (!componentes?.length) throw new Error("Este pedido não possui os itens históricos disponíveis. Informe os itens manualmente.");
  return componentes.map(componente => {
    const produto = produtos.find(p => p.id === componente.produto_id);
    const quantidade = Number(componente.quantidade);
    if (!produto?.codigo || !Number.isInteger(quantidade) || quantidade <= 0) {
      throw new Error("Não foi possível preencher os itens deste pedido. Confira o cadastro dos produtos e informe os itens manualmente.");
    }
    // O preço do kit não é o preço individual de cada produto.
    const valor = venda.kit_id ? null : Number(venda.valor_unitario) - Number(venda.desconto ?? 0) / quantidade;
    return {
      vendaId: venda.id, codigo: produto.codigo, quantidade: String(quantidade),
      valor: valor !== null && Number.isFinite(valor) && valor > 0 ? valor.toFixed(2) : "",
      ok: true,
    };
  });
}
